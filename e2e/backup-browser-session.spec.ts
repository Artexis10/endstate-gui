import { test, expect, Page } from './fixtures/tauri';
import { forceAdvancedMode } from './helpers/ui-mode';

/**
 * Hosted Backup — Manage subscription (Account Portal handoff) wiring.
 *
 * **Wiring test, not true end-to-end.** Validates that the GUI correctly
 * invokes `endstate backup browser-session` for the Manage button (active /
 * grace) and opens `${accountUrl}?session=${sessionToken}` via `shell.open`.
 * Engine, substrate, and `shell.open` are all mocked. A separate manual
 * smoke against a real Tauri build with the bundled engine ≥ v2.4.0 plus
 * substrate's `/account` deploy is required to validate the actual portal
 * flow.
 *
 * Pattern mirrors `backup-subscribe.spec.ts` — same `installBackupMock`
 * shape, same `plugin:shell|open` capture, same per-test config on
 * `window.__test_backupConfig`.
 *
 * See hosted-backup-contract.md §5 and the Endstate Account Portal
 * Architecture decision (2026-05-26).
 */

type Envelope<T> = {
  schemaVersion: string;
  cliVersion: string;
  command: string;
  runId: string;
  timestampUtc: string;
  success: boolean;
  data?: T;
  error?: { code: string; message: string; remediation?: string } | null;
};

function okEnvelope<T>(command: string, data: T): Envelope<T> {
  return {
    schemaVersion: '1.0',
    cliVersion: '2.4.0',
    command,
    runId: 'e2e-run',
    timestampUtc: '2026-05-27T00:00:00.000Z',
    success: true,
    data,
    error: null,
  };
}

interface BackupConfig {
  capabilities: Envelope<unknown>;
  status: Envelope<unknown>;
  list: Envelope<unknown>;
  browserSession:
    | { ok: true; data: { sessionToken: string; accountUrl: string }; delayMs?: number }
    | { ok: false; code: string; message: string; delayMs?: number };
}

const CAPABILITIES_HOSTED_BACKUP = okEnvelope('capabilities', {
  supportedSchemaVersions: { min: '1.0', max: '1.0' },
  commands: ['capabilities', 'apply', 'verify', 'capture', 'report', 'backup'],
  features: { hostedBackup: { supported: true } },
});

const STATUS_ACTIVE = okEnvelope('backup', {
  signedIn: true,
  email: 'tester@example.com',
  userId: 'usr_e2e',
  subscriptionStatus: 'active',
  issuerUrl: 'https://substratesystems.io',
});

const STATUS_GRACE = okEnvelope('backup', {
  signedIn: true,
  email: 'tester@example.com',
  userId: 'usr_e2e',
  subscriptionStatus: 'grace',
  graceEndsAt: '2026-06-15T00:00:00Z',
  issuerUrl: 'https://substratesystems.io',
});

const LIST_EMPTY = okEnvelope('backup', { backups: [] });

const BROWSER_SESSION_OK = {
  ok: true as const,
  data: {
    sessionToken: 'eyJhbGciOiJFZERTQSJ9.test.signature',
    accountUrl: 'https://substratesystems.io/account/start',
  },
};

async function installBackupMock(page: Page, config: BackupConfig) {
  await page.addInitScript((cfg) => {
    (window as any).__test_backupConfig = cfg;
    (window as any).__test_shellOpenCalls = [];

    const dispatchEndstateExec = async (params: { exe: string; args: string[] }) => {
      const args = params.args ?? [];
      const cmd = args[0];
      const c = (window as any).__test_backupConfig as BackupConfig;

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
        if (sub === 'browser-session') {
          if (c.browserSession.delayMs) {
            await new Promise((res) => setTimeout(res, c.browserSession.delayMs));
          }
          if (c.browserSession.ok) {
            return wrap({
              schemaVersion: '1.0',
              cliVersion: '2.4.0',
              command: 'backup',
              runId: 'e2e-run',
              timestampUtc: '2026-05-27T00:00:00.000Z',
              success: true,
              data: c.browserSession.data,
              error: null,
            });
          }
          return wrap(
            {
              schemaVersion: '1.0',
              cliVersion: '2.4.0',
              command: 'backup',
              runId: 'e2e-run',
              timestampUtc: '2026-05-27T00:00:00.000Z',
              success: false,
              data: undefined,
              error: { code: c.browserSession.code, message: c.browserSession.message },
            },
            1,
          );
        }
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
        if (cmd === 'plugin:shell|open') {
          (window as any).__test_shellOpenCalls.push(args?.path);
          return null;
        }
        const fallback = (window as any).__TAURI__?.core?.invoke;
        if (typeof fallback === 'function') return fallback(cmd, args);
        return null;
      },
      transformCallback: (cb: Function) => cb,
      unregisterCallback: () => undefined,
    };
  }, config);
}

async function navigateToBackup(page: Page) {
  await page.keyboard.press('Control+k');
  await expect(page.getByText('Go to Backup')).toBeVisible({ timeout: 3000 });
  await page.getByText('Go to Backup').click();
  await expect(page.getByTestId('backup-pane')).toBeVisible({ timeout: 5000 });
}

test.use({
  tauriMockOptions: {
    enableEventListeners: true,
  },
});

test.describe('Hosted Backup — Manage subscription / Account Portal handoff', () => {
  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
  });

  test('active state: Manage button mints token and opens accountUrl with ?session=', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_ACTIVE,
      list: LIST_EMPTY,
      browserSession: BROWSER_SESSION_OK,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const btn = page.getByTestId('subscription-manage');
    await expect(btn).toBeEnabled();
    await btn.click();

    await expect
      .poll(() => page.evaluate(() => (window as any).__test_shellOpenCalls?.length ?? 0), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    const opened = await page.evaluate(() => (window as any).__test_shellOpenCalls);
    expect(opened[0]).toContain('/account/start');
    expect(opened[0]).toContain('session=eyJhbGciOiJFZERTQSJ9.test.signature');
  });

  test('grace state: same flow, banner reads warn tone, button stays enabled', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_GRACE,
      list: LIST_EMPTY,
      browserSession: BROWSER_SESSION_OK,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const banner = page.getByTestId('subscription-banner');
    await expect(banner).toHaveAttribute('data-tone', 'warn');

    const btn = page.getByTestId('subscription-manage');
    await btn.click();

    await expect
      .poll(() => page.evaluate(() => (window as any).__test_shellOpenCalls?.length ?? 0), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    const opened = await page.evaluate(() => (window as any).__test_shellOpenCalls);
    expect(opened[0]).toContain('session=');
  });

  test('AUTH_REQUIRED routes through onAuthLost; opens re-auth dialog, no URL opened', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_ACTIVE,
      list: LIST_EMPTY,
      browserSession: { ok: false, code: 'AUTH_REQUIRED', message: 'Session expired.' },
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    await page.getByTestId('subscription-manage').click();

    await expect(page.getByTestId('reauth-dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('backup-pane')).toBeVisible();
    await expect(page.getByTestId('backup-pane-signed-out')).toHaveCount(0);

    const opened = await page.evaluate(() => (window as any).__test_shellOpenCalls);
    expect(opened).toHaveLength(0);
    await expect(page.getByTestId('backup-pane-error')).toHaveCount(0);
  });

  test('double-click guard: Manage button is disabled while engine round-trip is in flight', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_ACTIVE,
      list: LIST_EMPTY,
      browserSession: { ...BROWSER_SESSION_OK, delayMs: 800 },
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const btn = page.getByTestId('subscription-manage');
    await btn.click();

    await expect(btn).toBeDisabled({ timeout: 2000 });

    await expect
      .poll(() => page.evaluate(() => (window as any).__test_shellOpenCalls?.length ?? 0), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);
  });
});
