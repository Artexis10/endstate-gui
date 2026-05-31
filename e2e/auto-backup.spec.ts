import { test, expect, Page } from './fixtures/tauri';
import { forceAdvancedMode } from './helpers/ui-mode';

/**
 * Automatic hosted backup — Settings integration (wiring test).
 *
 * The full capture → background-push → chip / consent-prompt / paused-indicator
 * pipeline is covered by unit tests (`src/lib/auto-backup.test.ts`,
 * `auto-backup-consent.test.tsx`, `last-sync-indicator.test.tsx`,
 * `backup-capabilities.test.ts`) — driving the streaming capture+push pipeline
 * in Playwright is disproportionate (the nearest capture e2e is already skipped
 * for UI drift). This spec covers the end-to-end bit that the units can't: that
 * the reversible Settings toggle appears when hosted backup is supported, drives
 * `settings.autoBackupEnabled`, and persists across reloads. Same
 * `installBackupMock` shape as `backup-quota-notice.spec.ts`.
 */

type Envelope<T> = {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  runId: string;
  timestampUtc: string;
  success: boolean;
  data?: T;
  error?: { code: string; message: string } | null;
};

function okEnvelope<T>(command: string, data: T): Envelope<T> {
  return {
    schemaVersion: '1.0',
    cliVersion: '2.8.0',
    command,
    runId: 'e2e-run',
    timestampUtc: '2026-05-31T00:00:00.000Z',
    success: true,
    data,
    error: null,
  };
}

// Capabilities advertising hosted backup AND the `--if-changed` flag in the
// backup command's advertised flags (the canonical auto-backup capability gate).
const CAPABILITIES = okEnvelope('capabilities', {
  supportedSchemaVersions: { min: '1.0', max: '1.0' },
  commands: {
    capture: { supported: true, flags: ['--WithConfig', '--out', '--json'] },
    backup: {
      supported: true,
      flags: ['--profile', '--backup-id', '--name', '--if-changed', '--json'],
    },
  },
  features: { hostedBackup: { supported: true } },
});

const STATUS_ACTIVE = okEnvelope('backup', {
  signedIn: true,
  email: 'tester@example.com',
  userId: 'usr_e2e',
  subscriptionStatus: 'active',
  issuerUrl: 'https://substratesystems.io',
});

const LIST_EMPTY = okEnvelope('backup', { backups: [] });

async function installBackupMock(page: Page) {
  await page.addInitScript((cfg) => {
    (window as any).__test_cfg = cfg;
    const dispatchEndstateExec = async (params: { exe: string; args: string[] }) => {
      const args = params.args ?? [];
      const cmd = args[0];
      const c = (window as any).__test_cfg;
      const wrap = (envelope: unknown, exitCode = 0) => ({
        exitCode,
        stdout: JSON.stringify(envelope),
        stderr: '',
      });
      if (cmd === 'capabilities') return wrap(c.capabilities);
      if (cmd === 'backup') {
        const sub = args[2];
        if (sub === 'status') return wrap(c.status);
        if (sub === 'list') return wrap(c.list);
      }
      throw new Error(`e2e endstate_exec: unhandled args ${JSON.stringify(args)}`);
    };
    const installInvokeWrap = () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri?.core?.invoke) return false;
      const orig = tauri.core.invoke;
      const wrapped = async (cmd: string, args?: any) => {
        if (cmd === 'endstate_exec') return dispatchEndstateExec(args);
        return orig(cmd, args);
      };
      tauri.core.invoke = wrapped;
      tauri.invoke = wrapped;
      return true;
    };
    if (!installInvokeWrap()) queueMicrotask(installInvokeWrap);
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: any) => {
        const fallback = (window as any).__TAURI__?.core?.invoke;
        if (typeof fallback === 'function') return fallback(cmd, args);
        return null;
      },
      transformCallback: (cb: Function) => cb,
      unregisterCallback: () => undefined,
    };
  }, { capabilities: CAPABILITIES, status: STATUS_ACTIVE, list: LIST_EMPTY });
}

async function goToSettings(page: Page) {
  await page.keyboard.press('Control+k');
  await expect(page.getByText('Go to Settings')).toBeVisible({ timeout: 3000 });
  await page.getByText('Go to Settings').click();
}

test.use({ tauriMockOptions: { enableEventListeners: true } });

test.describe('Automatic backup — Settings toggle', () => {
  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
    await installBackupMock(page);
  });

  test('exposes a reversible auto-backup toggle that persists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await goToSettings(page);

    const toggle = page.getByRole('switch', { name: /automatic cloud backup/i });
    await expect(toggle).toBeVisible({ timeout: 5000 });
    // Defaults off until the user opts in.
    await expect(toggle).not.toBeChecked();

    // Turn it on.
    await toggle.click();
    await expect(toggle).toBeChecked();

    // Persists across a reload (loadSettings reads it back from storage).
    await page.reload();
    await page.waitForLoadState('networkidle');
    await goToSettings(page);
    await expect(
      page.getByRole('switch', { name: /automatic cloud backup/i }),
    ).toBeChecked();
  });
});
