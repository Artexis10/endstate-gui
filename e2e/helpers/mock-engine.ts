import { Page } from '@playwright/test';
import { installTauriMock } from './tauri-mock';

/**
 * Page-level mock engine for setup-flow specs.
 *
 * Specs replace the app's engine with `window.__ENDSTATE_MOCK_ENGINE__`. Every
 * such mock answers the startup `capabilities` and `report` calls the same way
 * and streams NDJSON the same way, so that plumbing lives here:
 *
 * - `installMockEngine` covers the common case: a fixed list of apps streamed
 *   as `item` events, then an apply envelope summarising them.
 * - `installEngineMocks` installs the Tauri mock and the browser-side kit only,
 *   for specs that script their own engine (restore runs, for example). Those
 *   specs read the kit as `window.__E2E_MOCK_KIT__` inside their init script.
 *
 * Init scripts run in the browser, so everything passed in must be serializable.
 */

export const TEST_PROFILE_FILE = 'C:\\test\\profiles\\test-profile.jsonc';

const DEFAULT_CAPABILITIES = ['capture', 'apply', 'verify', 'report'];

/** Browser-side helpers, exposed as `window.__E2E_MOCK_KIT__`. */
export interface MockEngineKit {
  /** Response for the startup `capabilities`/`report` calls, or null for any other command. */
  startup(command: string, capabilities?: string[]): unknown | null;
  /** Streams one NDJSON event to the app, then waits `delayMs` when it is above 0. */
  emitter(onEvent: Function | undefined, options: any, delayMs?: number): (evt: unknown) => Promise<void>;
  /** A completed run with this envelope `data`. */
  result(data: unknown, outcome?: { exitCode: number; success: boolean }): unknown;
}

function installKit(page: Page, defaultCapabilities: string[]): Promise<void> {
  return page.addInitScript((defaultCapabilities) => {
    const kit = {
      startup(command: string, capabilities?: string[]) {
        if (command === 'capabilities') {
          return { exitCode: 0, envelope: { success: true, data: { commands: capabilities ?? defaultCapabilities } }, ndjsonEvents: [] };
        }
        if (command === 'report') {
          return { exitCode: 0, envelope: { success: true, data: { hasState: false } }, ndjsonEvents: [] };
        }
        return null;
      },
      emitter(onEvent: Function | undefined, options: any, delayMs = 0) {
        return async (evt: unknown) => {
          options?.onNdjsonEvent?.(evt);
          onEvent?.({ type: 'stdout', data: JSON.stringify(evt) + '\n' });
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        };
      },
      result(data: unknown, outcome = { exitCode: 0, success: true }) {
        return { exitCode: outcome.exitCode, envelope: { success: outcome.success, data }, ndjsonEvents: [] };
      },
    };
    (window as any).__E2E_MOCK_KIT__ = kit;
  }, defaultCapabilities);
}

/**
 * Installs the Tauri mock with the test profile, the mock-engine kit, and
 * optionally replaces the stored GUI settings (before the app reads them).
 */
export async function installEngineMocks(page: Page, opts: { settings?: Record<string, unknown> } = {}): Promise<void> {
  await installTauriMock(page, { initialProfileFiles: [TEST_PROFILE_FILE] });
  await installKit(page, DEFAULT_CAPABILITIES);
  if (opts.settings) {
    await page.addInitScript((settings) => {
      localStorage.setItem('test:endstate-gui-settings', JSON.stringify(settings));
    }, opts.settings);
  }
}

export interface MockApp {
  id: string;
  name: string;
  /** Streamed on every run. Ignored when `installs` is set. */
  status?: string;
  reason?: string;
  /** Extra `message` on the streamed event only (the envelope action keeps ''). */
  message?: string;
  /** An app to install: `to_install`/`would_install` in a preview, `installed` on a real apply. */
  installs?: boolean;
}

export interface MockEngineOptions {
  apps: MockApp[];
  /** Commands the engine reports. Defaults to capture, apply, verify, report. */
  capabilities?: string[];
  /** When false the mock ignores `--dry-run` and answers every run as a real apply. Default true. */
  readsDryRunFlag?: boolean;
  /** Which commands stream the apps. Default 'apply'; other commands return an empty success. */
  streamOn?: 'apply' | 'every-command';
  /** Pause after each streamed app. */
  itemDelayMs?: number;
  /** Pause after streaming, before the envelope, per run kind. */
  settleDelayMs?: { preview?: number; apply?: number };
  /** Exit code and envelope success of a real apply. When set, every envelope also carries `error: null`. */
  applyOutcome?: { exitCode: number; success: boolean };
  /** Name of a window counter (starting at 0) bumped on each `apply` call. */
  applyCallCounter?: string;
  /**
   * Holds a real apply until the test releases it: the mock sets
   * `window.__APPLY_STARTED__`, prints `[INSTALL] <id>` for each app it installs,
   * then waits for `window.__APPLY_RESOLVER__()` (or 10s) before streaming.
   */
  holdRealApply?: boolean;
}

/** Installs the Tauri mock, the test profile and a mock engine that streams `opts.apps`. */
export async function installMockEngine(page: Page, opts: MockEngineOptions): Promise<void> {
  await installEngineMocks(page);
  await page.addInitScript((opts) => {
    const w = window as any;
    const kit = w.__E2E_MOCK_KIT__;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    if (opts.applyCallCounter) w[opts.applyCallCounter] = 0;
    if (opts.holdRealApply) {
      w.__APPLY_STARTED__ = false;
      w.__APPLY_COMPLETE__ = false;
      w.__APPLY_RESOLVER__ = null;
    }

    w.__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: async (_settings: any, command: string, args: string[], onEvent: Function, options?: any) => {
        const startup = kit.startup(command, opts.capabilities);
        if (startup) return startup;
        if (command !== 'apply' && opts.streamOn !== 'every-command') return kit.result({});
        if (command === 'apply' && opts.applyCallCounter) w[opts.applyCallCounter]++;

        const isDryRun = opts.readsDryRunFlag !== false && args.includes('--dry-run');

        if (!isDryRun && opts.holdRealApply) {
          w.__APPLY_STARTED__ = true;
          for (const app of opts.apps.filter((a) => a.installs)) {
            onEvent({ type: 'stdout', data: `[INSTALL] ${app.id}\n` });
          }
          await new Promise<void>((resolve) => {
            w.__APPLY_RESOLVER__ = resolve;
            setTimeout(() => {
              if (!w.__APPLY_COMPLETE__) {
                w.__APPLY_COMPLETE__ = true;
                resolve();
              }
            }, 10000);
          });
        }

        const items = opts.apps.map((app) => ({
          event: 'item',
          id: app.id,
          driver: 'winget',
          status: app.installs ? (isDryRun ? 'to_install' : 'installed') : app.status,
          reason: app.installs ? (isDryRun ? 'would_install' : 'installed') : app.reason,
          name: app.name,
          ...(app.message !== undefined ? { message: app.message } : {}),
        }));
        const emit = kit.emitter(onEvent, options, opts.itemDelayMs ?? 0);
        for (const item of items) await emit(item);

        const settleMs = isDryRun ? opts.settleDelayMs?.preview : opts.settleDelayMs?.apply;
        if (settleMs) await sleep(settleMs);

        const outcome = !isDryRun && opts.applyOutcome ? opts.applyOutcome : { exitCode: 0, success: true };
        return {
          exitCode: outcome.exitCode,
          envelope: {
            success: outcome.success,
            ...(opts.applyOutcome ? { error: null } : {}),
            data: {
              dryRun: isDryRun,
              summary: {
                total: items.length,
                success: isDryRun ? 0 : items.filter((i) => i.status === 'installed').length,
                skipped: items.filter((i) => i.status === 'present').length,
                failed: items.filter((i) => i.status === 'failed').length,
              },
              actions: items.map((i) => ({
                id: i.id, ref: i.id, driver: i.driver, name: i.name,
                status: i.status, reason: i.reason ?? '', message: '',
                version: '', manual: null,
              })),
            },
          },
          ndjsonEvents: items,
        };
      },
    };
  }, opts);
}
