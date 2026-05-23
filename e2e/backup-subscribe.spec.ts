import { test, expect, Page } from './fixtures/tauri';
import { forceAdvancedMode } from './helpers/ui-mode';

/**
 * Hosted Backup — Subscribe / Renew checkout wiring (engine ≥ v2.1.0).
 *
 * **Wiring test, not true end-to-end.** This validates that the GUI
 * components correctly invoke `endstate backup subscribe` and react to its
 * envelope responses. Engine, substrate, and `shell.open` are all mocked. A
 * separate manual smoke against a real Tauri build with the bundled v2.1.0
 * engine is required to validate the actual checkout flow.
 *
 * Backup commands flow through `endstate_exec` in this harness. The
 * mechanism (load-bearing for anyone copying this pattern): stubbing
 * `window.__TAURI_INTERNALS__` (required so `@tauri-apps/plugin-shell`'s
 * `open()` doesn't TypeError) also flips `isTauriRuntime()` to true at
 * `tauri-bridge.ts:58`. That routes `runEndstateOnce` through the Tauri
 * invoke path — i.e. `invoke('endstate_exec', ...)` — *not* the
 * `__ENDSTATE_MOCK_ENGINE__.runEndstateOnce` branch. So we wrap
 * `__TAURI__.core.invoke` to dispatch `endstate_exec`, and stub
 * `__TAURI_INTERNALS__.invoke` to capture `plugin:shell|open`. Full
 * mechanism comment is inline at `installBackupMock` below.
 *
 * Pattern for future backup specs:
 *  - per-test config on `window.__test_backupConfig` (status, subscribe
 *    response, optional delay) — the mock dispatches from it.
 *  - sidebar is hidden on intent pages (landing/save/setup); navigate via the
 *    command palette (`Ctrl+K → "Go to Backup"`), matching
 *    `reports-log-visibility.spec.ts`.
 *  - `plugin:shell|open` is captured into `window.__test_shellOpenCalls`.
 */

// ---------------------------------------------------------------------------
// Envelope helpers (shared with future backup specs)
// ---------------------------------------------------------------------------

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
    cliVersion: '2.1.0',
    command,
    runId: 'e2e-run',
    timestampUtc: '2026-05-23T00:00:00.000Z',
    success: true,
    data,
    error: null,
  };
}

function errEnvelope(command: string, code: string, message: string): Envelope<never> {
  return {
    schemaVersion: '1.0',
    cliVersion: '2.1.0',
    command,
    runId: 'e2e-run',
    timestampUtc: '2026-05-23T00:00:00.000Z',
    success: false,
    error: { code, message },
  };
}

// ---------------------------------------------------------------------------
// Per-test config
// ---------------------------------------------------------------------------

interface BackupConfig {
  capabilities: Envelope<unknown>;
  status: Envelope<unknown>;
  list: Envelope<unknown>;
  subscribe:
    | { ok: true; data: { checkoutUrl: string; transactionId: string }; delayMs?: number }
    | { ok: false; code: string; message: string; delayMs?: number };
}

const CAPABILITIES_HOSTED_BACKUP = okEnvelope('capabilities', {
  supportedSchemaVersions: { min: '1.0', max: '1.0' },
  commands: ['capabilities', 'apply', 'verify', 'capture', 'report', 'backup'],
  features: { hostedBackup: { supported: true } },
});

const STATUS_NONE = okEnvelope('backup', {
  signedIn: true,
  email: 'tester@example.com',
  userId: 'usr_e2e',
  subscriptionStatus: 'none',
  issuerUrl: 'https://substratesystems.io',
});

const STATUS_CANCELLED = okEnvelope('backup', {
  signedIn: true,
  email: 'tester@example.com',
  userId: 'usr_e2e',
  subscriptionStatus: 'cancelled',
  issuerUrl: 'https://substratesystems.io',
});

const LIST_EMPTY = okEnvelope('backup', { backups: [] });

const SUBSCRIBE_OK = {
  ok: true as const,
  data: {
    checkoutUrl: 'https://substratesystems.io/endstate?_ptxn=txn_e2e_abc',
    transactionId: 'txn_e2e_abc',
  },
};

/**
 * Install the per-test backup mock. Must be called BEFORE `page.goto('/')`.
 *
 * Overrides the fixture's streaming-only `__ENDSTATE_MOCK_ENGINE__` with a
 * `runEndstateOnce` that reads `window.__test_backupConfig` and returns an
 * `EngineExecResult` matching what the GUI's `runEndstateOnce` produces in
 * the Tauri-runtime path (so `backup-bridge.runBackupOnce` reaches the same
 * branches it would in production).
 */
async function installBackupMock(page: Page, config: BackupConfig) {
  await page.addInitScript((cfg) => {
    (window as any).__test_backupConfig = cfg;
    (window as any).__test_shellOpenCalls = [];

    // -----------------------------------------------------------------------
    // Two invoke paths need mocking, for different reasons:
    //
    // 1. `@tauri-apps/plugin-shell`'s `open()` imports `invoke` from
    //    `@tauri-apps/api/core`, which calls `window.__TAURI_INTERNALS__.invoke(...)`
    //    directly — bypassing `tauri-bridge.ts` and the fixture's
    //    `__TAURI__.core.invoke` mock. So we stub `__TAURI_INTERNALS__` to
    //    capture `plugin:shell|open` calls.
    //
    // 2. Setting `__TAURI_INTERNALS__` makes `isTauriRuntime()` return true
    //    (see `tauri-bridge.ts:58`). That routes `runEndstateOnce` through
    //    the Tauri-invoke path (`invoke('endstate_exec', ...)`) instead of
    //    the mock-engine path. We then wrap `__TAURI__.core.invoke` to
    //    handle `endstate_exec` from `window.__test_backupConfig`, falling
    //    through to the fixture's defaults for everything else (plugin-store
    //    etc.).
    //
    // Functions live in this page-level addInitScript body (not passed via
    // `tauriMockOptions.invoke`) because Playwright JSON-serializes the
    // addInitScript arg and strips function values.
    // -----------------------------------------------------------------------

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
        // Args shape from `runEndstateOnce` is [command, '--json', ...args]
        // (engine-exec.ts:147), so the subcommand lives at position 2.
        // Using a positional lookup (rather than a "first non-flag" heuristic)
        // keeps the dispatcher robust if future wrappers pass a flag value
        // with no `--` prefix.
        const sub = args[2];
        if (sub === 'status') return wrap(c.status);
        if (sub === 'list') return wrap(c.list);
        if (sub === 'subscribe') {
          if (c.subscribe.delayMs) {
            await new Promise((res) => setTimeout(res, c.subscribe.delayMs));
          }
          if (c.subscribe.ok) {
            return wrap({
              schemaVersion: '1.0',
              cliVersion: '2.1.0',
              command: 'backup',
              runId: 'e2e-run',
              timestampUtc: '2026-05-23T00:00:00.000Z',
              success: true,
              data: c.subscribe.data,
              error: null,
            });
          }
          // Domain failure — envelope.success=false. The bridge sees this
          // and throws BackupCommandError(code), same as the engine path.
          return wrap(
            {
              schemaVersion: '1.0',
              cliVersion: '2.1.0',
              command: 'backup',
              runId: 'e2e-run',
              timestampUtc: '2026-05-23T00:00:00.000Z',
              success: false,
              data: undefined,
              error: { code: c.subscribe.code, message: c.subscribe.message },
            },
            1,
          );
        }
      }

      throw new Error(`e2e endstate_exec: unhandled args ${JSON.stringify(args)}`);
    };

    // Wrap __TAURI__.core.invoke to add the endstate_exec handler. We
    // microtask-defer if __TAURI__ isn't ready yet (context init script
    // hasn't run); in practice it has, but be defensive.
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

    // Stub __TAURI_INTERNALS__ for `@tauri-apps/api/core` direct consumers.
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

/**
 * Navigate from the landing page to the Backup pane via the command palette.
 * The sidebar is hidden on intent pages.
 */
async function navigateToBackup(page: Page) {
  await page.keyboard.press('Control+k');
  await expect(page.getByText('Go to Backup')).toBeVisible({ timeout: 3000 });
  await page.getByText('Go to Backup').click();
  await expect(page.getByTestId('backup-pane')).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Fixture: capture shell.open URLs via the Tauri invoke mock
// ---------------------------------------------------------------------------

test.use({
  tauriMockOptions: {
    enableEventListeners: true,
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Hosted Backup — Subscribe / Renew checkout wiring', () => {
  test.beforeEach(async ({ page }) => {
    await forceAdvancedMode(page);
  });

  test('Subscribe (none) invokes backup subscribe and opens the returned checkoutUrl', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_NONE,
      list: LIST_EMPTY,
      subscribe: SUBSCRIBE_OK,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const btn = page.getByTestId('subscription-subscribe');
    await expect(btn).toBeEnabled();
    await btn.click();

    await expect
      .poll(() => page.evaluate(() => (window as any).__test_shellOpenCalls?.length ?? 0), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    const opened = await page.evaluate(() => (window as any).__test_shellOpenCalls);
    expect(opened[0]).toContain('_ptxn=txn_e2e_abc');
  });

  test('Renew (cancelled) uses the same backup subscribe checkout path', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_CANCELLED,
      // Cancelled allows reads; the app prefetches `backup list` — return empty.
      list: LIST_EMPTY,
      subscribe: SUBSCRIBE_OK,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const banner = page.getByTestId('subscription-banner');
    await expect(banner).toHaveAttribute('data-tone', 'error');

    const btn = page.getByTestId('subscription-renew');
    await expect(btn).toBeEnabled();
    await btn.click();

    await expect
      .poll(() => page.evaluate(() => (window as any).__test_shellOpenCalls?.length ?? 0), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    const opened = await page.evaluate(() => (window as any).__test_shellOpenCalls);
    expect(opened[0]).toContain('_ptxn=txn_e2e_abc');
  });

  test('AUTH_REQUIRED routes through onAuthLost; no checkoutUrl opens', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_NONE,
      list: LIST_EMPTY,
      subscribe: { ok: false, code: 'AUTH_REQUIRED', message: 'Sign in to begin checkout.' },
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    await page.getByTestId('subscription-subscribe').click();

    // onAuthLost clears backupStatusData → pane re-renders the signed-out
    // fallback ("Sign in to view your hosted backups.").
    await expect(page.getByTestId('backup-pane-signed-out')).toBeVisible({ timeout: 5000 });

    const opened = await page.evaluate(() => (window as any).__test_shellOpenCalls);
    expect(opened).toHaveLength(0);
    await expect(page.getByTestId('backup-pane-error')).toHaveCount(0);

    // Spec requirement: no error toast on AUTH_REQUIRED — handleCheckout's
    // catch branch returns early and lets onAuthLost route to the calm
    // signed-out fallback instead of surfacing a toast.
    await expect(
      page.getByRole('alert').filter({ hasText: /authentication required|sign in/i }),
    ).toHaveCount(0);
  });

  test('double-mint guard: Subscribe button is disabled while a checkout is in flight', async ({ page }) => {
    await installBackupMock(page, {
      capabilities: CAPABILITIES_HOSTED_BACKUP,
      status: STATUS_NONE,
      list: LIST_EMPTY,
      subscribe: { ...SUBSCRIBE_OK, delayMs: 800 },
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navigateToBackup(page);

    const btn = page.getByTestId('subscription-subscribe');
    await btn.click();

    await expect(btn).toBeDisabled({ timeout: 2000 });

    await expect
      .poll(() => page.evaluate(() => (window as any).__test_shellOpenCalls?.length ?? 0), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);
  });
});
