import { test, expect, Page } from './fixtures/tauri';
import { forceAdvancedMode } from './helpers/ui-mode';

/**
 * Hosted Backup — QuotaNotice tone bands (Wave 2 polish).
 *
 * **Wiring test, not true end-to-end.** Validates that the persistent
 * quota-near-limit banner renders the correct tone + copy for each band
 * (warn at >=50%, danger at >=90%, absent under 50%) using mocked engine
 * envelopes. Mirrors `backup-browser-session.spec.ts` — same
 * `installBackupMock` shape, same envelope helpers, same Tauri fixture
 * import.
 *
 * Each test also asserts `data-testid="last-sync-indicator"` presence —
 * covers LastSyncIndicator rendering as a side-effect without a separate
 * spec. See plan `polish-backup-pane-status-visibility`, task 5.2.
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
}

const CAPABILITIES_HOSTED_BACKUP = okEnvelope('capabilities', {
  supportedSchemaVersions: { min: '1.0', max: '1.0' },
  commands: ['capabilities', 'apply', 'verify', 'capture', 'report', 'backup'],
  features: { hostedBackup: { supported: true } },
});

function statusWithQuota(usedBytes: number, totalBytes: number) {
  return okEnvelope('backup', {
    signedIn: true,
    email: 'tester@example.com',
    userId: 'usr_e2e',
    subscriptionStatus: 'active',
    issuerUrl: 'https://substratesystems.io',
    lastBackupAt: '2026-05-27T00:00:00.000Z',
    quotaUsedBytes: usedBytes,
    quotaTotalBytes: totalBytes,
  });
}

const LIST_EMPTY = okEnvelope('backup', { backups: [] });

async function installBackupMock(page: Page, config: BackupConfig) {
  await page.addInitScript((cfg) => {
    (window as any).__test_backupConfig = cfg;

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

    // Stubbing __TAURI_INTERNALS__ is load-bearing — it flips
    // isTauriRuntime() to true at tauri-bridge.ts so backup commands route
    // through endstate_exec (above) instead of the mock-engine branch.
    // See the lengthy comment in backup-subscribe.spec.ts lines 13-22.
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: any) => {
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

test.describe('Hosted Backup — QuotaNotice tone bands', () => {
  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
  });

  test('shows warn-tone notice at >=50% storage usage', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: statusWithQuota(750_000_000, 1_000_000_000), // 75%
      list: LIST_EMPTY,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const notice = page.getByTestId('quota-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('data-tone', 'warn');
    await expect(notice).toContainText('75%');

    await expect(page.getByTestId('last-sync-indicator')).toBeVisible();
  });

  test('shows danger-tone notice at >=90% storage usage', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: statusWithQuota(950_000_000, 1_000_000_000), // 95%
      list: LIST_EMPTY,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const notice = page.getByTestId('quota-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('data-tone', 'danger');
    await expect(notice).toContainText('95%');
    await expect(notice).toContainText('almost full');

    await expect(page.getByTestId('last-sync-indicator')).toBeVisible();
  });

  test('does not render notice under 50%', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: statusWithQuota(100_000_000, 1_000_000_000), // 10%
      list: LIST_EMPTY,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    // Ensure the pane has finished rendering before asserting absence.
    await expect(page.getByTestId('last-sync-indicator')).toBeVisible();

    await expect(page.getByTestId('quota-notice')).toHaveCount(0);
  });
});
