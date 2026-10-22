import { test, expect } from '@playwright/test';
import { installMockEngine } from './helpers/mock-engine';
import { openApp, previewTestProfile } from './helpers/ui-mode';

/**
 * E2E Test: Apply -> Navigate Away -> Back -> UI Persistence
 *
 * Tests that setup flow state persists across the component lifecycle.
 * The SetupFlow is always-mounted (hidden via CSS display:none when not active),
 * so internal state should survive navigating to settings/reports and back.
 */

/**
 * `dryRunEnabled` defaults to true in settings.ts. Both describes below
 * exercise the real-apply path (UI assertions around "Installing…" and
 * the partial-failure surface), so they must force the setting to false
 * — otherwise the GUI passes `--dry-run` (per the App.tsx fix) and the
 * mocks take their dry-run branch, which short-circuits these tests.
 */
async function seedDryRunOff(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const KEY = 'test:endstate-gui-settings';
    const existing = localStorage.getItem(KEY);
    const settings = existing ? JSON.parse(existing) : {};
    settings.dryRunEnabled = false;
    localStorage.setItem(KEY, JSON.stringify(settings));
  });
}

test.describe('Apply Navigation Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEngine(page, {
      capabilities: ['capture', 'apply', 'report'],
      holdRealApply: true,
      apps: [
        { id: 'Discord.Discord', name: 'Discord', installs: true },
        { id: 'Google.Chrome', name: 'Chrome', status: 'present', reason: 'already_installed' },
      ],
    });
    await seedDryRunOff(page);
    await openApp(page);
  });

  test('Setup flow completes preview and shows apply button', async ({ page }) => {
    await previewTestProfile(page);
    await expect(page.locator('text=Preview complete')).toBeVisible();
    await expect(page.locator('text=/to install/i').first()).toBeVisible();
    await expect(page.locator('[data-testid="setup-flow-apply"]')).toBeVisible();
  });

  test('Apply runs and completes with success', async ({ page }) => {
    await previewTestProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();

    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__APPLY_STARTED__);
    }, { timeout: 5000 }).toBe(true);

    await page.evaluate(() => {
      (window as any).__APPLY_COMPLETE__ = true;
      if ((window as any).__APPLY_RESOLVER__) {
        (window as any).__APPLY_RESOLVER__();
      }
    });

    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Apply Completion States', () => {
  test('shows success completion UI after successful apply', async ({ page }) => {
    await installMockEngine(page, {
      capabilities: ['capture', 'apply', 'report'],
      settleDelayMs: { preview: 100, apply: 100 },
      apps: [{ id: 'Discord.Discord', name: 'Discord', installs: true }],
    });
    await openApp(page);
    await previewTestProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup complete')).toBeVisible({ timeout: 10000 });
  });

  test('shows partial failure UI when some apps fail', async ({ page }) => {
    await installMockEngine(page, {
      capabilities: ['capture', 'apply', 'report'],
      settleDelayMs: { preview: 100, apply: 100 },
      applyOutcome: { exitCode: 1, success: false },
      apps: [
        { id: 'Discord.Discord', name: 'Discord', installs: true },
        { id: 'BrokenApp.App', name: 'Broken App', status: 'failed', reason: 'install_failed' },
      ],
    });
    // Force real-apply path; this test asserts on partial-failure surface.
    await seedDryRunOff(page);
    await openApp(page);
    await previewTestProfile(page);

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.locator('text=Setup completed with errors')).toBeVisible({ timeout: 10000 });
  });
});
