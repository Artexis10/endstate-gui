/**
 * Scheduled drift-check ("Continuous protection") CLI bridge.
 *
 * Typed wrappers for the `endstate schedule *` subcommand family. Each wrapper
 * invokes the engine via the existing `runEndstateOnce` (single-envelope)
 * helper and returns typed envelope `data` or throws `ScheduleCommandError`.
 * Mirrors `backup-bridge.ts`.
 *
 * The GUI renders schedule status only — drift detection, task registration,
 * and last-run persistence all live in the engine (CLI is source of truth; see
 * ../endstate/docs/contracts/cli-json-contract.md "Command: schedule").
 */

import { runEndstateOnce } from './engine-exec';
import { AppSettings } from '../settings';
import {
  EndstateEnvelope,
  EndstateCapabilitiesData,
  ScheduleEnableData,
  ScheduleDisableData,
  ScheduleStatusData,
} from '../types';

/**
 * Structured error from a schedule command.
 *
 * Wraps the engine's `error` envelope so callers receive `code` + `message` +
 * `remediation` rather than untyped strings. Stable codes: `NOT_SUPPORTED`,
 * `TASK_REGISTRATION_FAILED`, `SCHEDULE_DISABLED`, `MANIFEST_NOT_FOUND`.
 */
export class ScheduleCommandError extends Error {
  readonly code: string;
  readonly remediation?: string;
  readonly detail?: Record<string, unknown>;

  constructor(args: {
    code: string;
    message: string;
    remediation?: string;
    detail?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = 'ScheduleCommandError';
    this.code = args.code;
    this.remediation = args.remediation;
    this.detail = args.detail;
  }
}

/** Run a one-shot `schedule` subcommand and return typed `data`. */
async function runScheduleOnce<T>(
  settings: AppSettings,
  args: string[],
): Promise<T> {
  const result = await runEndstateOnce<EndstateEnvelope<T>>(
    settings,
    'schedule',
    args,
  );

  if (!result.success) {
    // Surface the engine's error envelope when the JSON parsed; otherwise wrap
    // the runtime failure (CLI not found, no output, etc.).
    const envelope = result.envelope as EndstateEnvelope<T> | undefined;
    if (envelope?.error) {
      throw new ScheduleCommandError({
        code: envelope.error.code,
        message: envelope.error.message,
        remediation: envelope.error.remediation,
        detail: envelope.error.detail,
      });
    }
    // No parseable envelope: this is a GUI-transport failure, not an engine
    // error. The code is the uppercased `EngineErrorKind` from engine-exec
    // (COMMAND_NOT_FOUND, INVOKE_FAILED, ENGINE_UNAVAILABLE_WEB,
    // COMMAND_FAILED) — a distinct namespace from the engine's stable
    // envelope codes documented on ScheduleCommandError (NOT_SUPPORTED,
    // TASK_REGISTRATION_FAILED, SCHEDULE_DISABLED, MANIFEST_NOT_FOUND).
    // Callers matching on engine codes must not expect transport codes to
    // be stable engine API.
    throw new ScheduleCommandError({
      code: result.error.kind.toUpperCase(),
      message: result.error.message,
      detail: result.error.stderr ? { stderr: result.error.stderr } : undefined,
    });
  }

  if (!result.envelope.success) {
    const err = result.envelope.error;
    throw new ScheduleCommandError({
      code: err?.code ?? 'UNKNOWN_ERROR',
      message: err?.message ?? 'Command failed without an error message.',
      remediation: err?.remediation,
      detail: err?.detail,
    });
  }

  return result.envelope.data;
}

export interface ScheduleEnableArgs {
  /** Absolute path to the manifest the scheduled run verifies against. */
  manifest: string;
  /** Time-of-day in HH:MM (24h). Engine defaults to 09:00 when omitted. */
  time?: string;
  /** Check cadence. Engine defaults to daily when omitted. */
  interval?: 'daily' | 'weekly';
  /** Capture + push automatically when the check finds changes. */
  autoPush?: boolean;
}

/**
 * Register (or re-assert) the scheduled drift check.
 *
 * Enable is idempotent on the engine side (`schtasks /F`): re-running it
 * re-asserts the task with the current executable path and configuration, so
 * callers use it both for first-time consent and for launch-time self-heal.
 */
export async function scheduleEnable(
  settings: AppSettings,
  args: ScheduleEnableArgs,
): Promise<ScheduleEnableData> {
  const cliArgs: string[] = ['enable', '--manifest', args.manifest];
  if (args.interval) cliArgs.push('--interval', args.interval);
  if (args.time) cliArgs.push('--time', args.time);
  if (args.autoPush) cliArgs.push('--auto-push');
  return runScheduleOnce<ScheduleEnableData>(settings, cliArgs);
}

/** Unregister the scheduled drift check (engine retains config, disabled). */
export async function scheduleDisable(
  settings: AppSettings,
): Promise<ScheduleDisableData> {
  return runScheduleOnce<ScheduleDisableData>(settings, ['disable']);
}

/** Report the persisted schedule config + last-run outcome. */
export async function scheduleStatus(
  settings: AppSettings,
): Promise<ScheduleStatusData> {
  return runScheduleOnce<ScheduleStatusData>(settings, ['status']);
}

/** True when the path points at a zip bundle (case-insensitive). */
export function isZipPath(path: string): boolean {
  return /\.zip$/i.test(path.trim());
}

/**
 * Resolve the drift-check baseline manifest for a freshly saved capture.
 *
 * The engine's scheduled run (`schedule run` → verify) parses raw JSONC
 * only — a `.zip` bundle path baked into the task would fail every scheduled
 * run permanently. Manifest-only saves are their own baseline; zip saves must
 * side-write the bundle's embedded `manifest.jsonc` (always present at the
 * archive root, per the engine's capture-bundle-zip spec) next to the zip and
 * use that instead.
 *
 * Returns the path to record as `scheduleManifestPath`, or `null` when no
 * scheduler-compatible baseline could be produced (extraction failed).
 * Callers MUST leave the previous baseline untouched on `null` — a `.zip`
 * path is never a valid baseline.
 *
 * @param savePath - Where the user saved the capture (.jsonc or .zip)
 * @param extractManifest - Side-writes the zip's embedded manifest.jsonc to
 *                          the given destination (Tauri `extract_zip_manifest`)
 */
export async function resolveScheduleBaselinePath(
  savePath: string,
  extractManifest: (zipPath: string, destPath: string) => Promise<void>,
): Promise<string | null> {
  if (!isZipPath(savePath)) return savePath;
  const destPath = `${savePath}.manifest.jsonc`;
  try {
    await extractManifest(savePath, destPath);
    return destPath;
  } catch (err) {
    // Best-effort: the save itself succeeded; only the baseline update is
    // skipped. The previously recorded baseline (if any) remains in force.
    console.warn('schedule baseline side-write failed:', err);
    return null;
  }
}

/**
 * Whether the engine advertises the scheduled drift-check feature.
 *
 * Defaults to FALSE when unknown so the entire Continuous Protection surface
 * ships dark against engines that predate the `schedule` command family
 * (bundled ≤ 2.21).
 */
export function engineSupportsSchedule(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  return caps?.features?.schedule?.supported === true;
}

/**
 * Whether the engine advertises `schedule run --auto-push` (backup on drift).
 * Defaults to FALSE when unknown.
 */
export function engineSupportsScheduleAutoPush(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  return caps?.features?.schedule?.autoPush === true;
}

/**
 * UI-facing drift state derived from `schedule status`.
 *
 * Pure mapping — no drift logic happens client-side; the engine's last-run
 * document is the only input. Chip rendering: `never-run` and `clean` show
 * nothing, `drift` shows the amber chip, `failing` shows the muted chip.
 */
export type DriftChipState =
  | { kind: 'never-run' }
  | { kind: 'clean'; checkedAt: string }
  | { kind: 'drift'; count: number; checkedAt: string }
  | { kind: 'failing'; checkedAt: string };

export function driftStateFromStatus(
  status: ScheduleStatusData | null | undefined,
): DriftChipState {
  // Disabled (or unknown) schedules surface nothing: with no future runs the
  // retained last-run document is stale by definition.
  if (!status?.enabled) return { kind: 'never-run' };

  const lastRun = status.lastRun;
  if (!lastRun) return { kind: 'never-run' };

  if (lastRun.error) {
    return { kind: 'failing', checkedAt: lastRun.timestampUtc };
  }

  const count = lastRun.verify?.summary?.fail ?? lastRun.verify?.drifted?.length ?? 0;
  if (count > 0) {
    return { kind: 'drift', count, checkedAt: lastRun.timestampUtc };
  }
  return { kind: 'clean', checkedAt: lastRun.timestampUtc };
}
