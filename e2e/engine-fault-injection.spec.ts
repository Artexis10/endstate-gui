import { test, expect, Page } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

/**
 * Engine fault injection (unhappy paths) — launch-readiness lane L4.
 *
 * Proves the GUI can NEVER render an engine crash, a corrupted NDJSON line, or
 * a cancel mid-run as success. These specs drive the built-in deterministic
 * mock engine (src/e2e/mock-engine.ts) via its scenario hook — no engine is
 * spawned. The fault scenarios keep app init and the dry-run preview healthy,
 * then inject the fault on the real (non-dry-run) apply so the flow reaches the
 * Apply button first (see getScenarioForCommand in mock-engine.ts).
 */

const PROFILE_FILE = 'C:\\test\\profiles\\test-profile.jsonc';

/** Boot the app into a given fault scenario against the built-in mock engine. */
async function boot(
  page: Page,
  baseURL: string | undefined,
  scenario: string,
  opts: { wireCancel?: boolean } = {},
): Promise<void> {
  await installTauriMock(page, { initialProfileFiles: [PROFILE_FILE] });

  // Select the fault scenario for the built-in mock (installed by main.tsx when
  // VITE_E2E=1). We do NOT override __ENDSTATE_MOCK_ENGINE__ — the whole point
  // is to exercise the mock-engine.ts fault code.
  await page.addInitScript((s) => {
    (window as any).__ENDSTATE_E2E_SCENARIO__ = s;
  }, scenario);

  if (opts.wireCancel) {
    // Bridge the app's real engine_cancel invoke to the mock's cancel signal.
    // The app calls it through window.__TAURI__.core.invoke (see tauri-bridge),
    // so we wrap that to set the flag the cancel scenario polls.
    await page.addInitScript(() => {
      const patch = () => {
        const tauri = (window as any).__TAURI__;
        if (!tauri || !tauri.core || typeof tauri.core.invoke !== 'function') {
          setTimeout(patch, 0);
          return;
        }
        if ((tauri.core.invoke as any).__cancelWrapped) return;
        const orig = tauri.core.invoke.bind(tauri.core);
        const wrapped = (cmd: string, args?: any) => {
          if (cmd === 'engine_cancel') {
            (window as any).__ENDSTATE_E2E_CANCEL_REQUESTED__ = true;
            return Promise.resolve(null);
          }
          return orig(cmd, args);
        };
        (wrapped as any).__cancelWrapped = true;
        tauri.core.invoke = wrapped;
        (tauri as any).invoke = wrapped;
      };
      patch();
    });
  }

  await page.goto(baseURL || '/');
  await page.waitForLoadState('networkidle');
}

/** Drive the setup flow up to a completed preview so Apply is available. */
async function previewProfile(page: Page): Promise<void> {
  await page.locator('[data-testid="intent-setup"]').click();
  await expect(page.locator('[data-testid="setup-flow"]')).toBeVisible({ timeout: 5000 });
  await page.locator('[data-testid="profile-card-test-profile"]').click();
  await expect(page.locator('text=Preview complete')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
}

test.describe('Engine fault injection — a fault never renders as success', () => {
  test('crash mid-run shows a failure, never a stale "Setup complete"', async ({ page, baseURL }) => {
    await boot(page, baseURL, 'crash_mid_run');
    await previewProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();

    // Engine died with no terminal envelope → the error card, not a result card.
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 10000 });
    // The success summary must never appear.
    await expect(page.getByText('Setup complete', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Setup completed with errors')).toHaveCount(0);
    // The flow stays interactive (recovery affordance present; both the header
    // nav and the error card offer a way back).
    await expect(page.getByRole('button', { name: /back to profiles/i }).first()).toBeVisible();
  });

  test('a malformed line mid-stream does not corrupt an otherwise-normal completion', async ({ page, baseURL }) => {
    await boot(page, baseURL, 'malformed_line_then_ok');
    await previewProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();

    // The run recovers from the corrupted line and completes normally.
    await expect(page.getByText('Setup complete', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    // The raw corrupted NDJSON fragment must never leak into the UI.
    await expect(page.getByText('{"version"', { exact: false })).toHaveCount(0);
    await expect(page.getByText('panic', { exact: false })).toHaveCount(0);
  });

  test('cancel mid-run ends the run canceled, never success', async ({ page, baseURL }) => {
    await boot(page, baseURL, 'cancel_mid_run', { wireCancel: true });
    await previewProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();

    // Wait for the run to be under way, then cancel via the app's real
    // engine_cancel command (the mock's cancel scenario polls for it).
    await expect(page.getByText('Applying setup...').first()).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => (window as any).__TAURI__.core.invoke('engine_cancel'));

    // The canceled run surfaces as a failure, never a success summary.
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Setup complete', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Setup completed with errors')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /back to profiles/i }).first()).toBeVisible();
  });
});
