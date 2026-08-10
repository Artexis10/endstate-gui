/**
 * Scheduled setup checks CLI bridge.
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
import { isBundlePath } from './profile-extensions';

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
  /** Engine-pinned backup target for scheduled Cloud uploads. */
  backupId?: string;
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
  if (args.backupId) cliArgs.push('--backup-id', args.backupId);
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

/** Explicitly discard one legacy ambiguous queued upload; local capture stays intact. */
export async function scheduleDiscardUpload(
  settings: AppSettings,
  artifactSha256: string,
): Promise<{ discarded: boolean }> {
  return runScheduleOnce<{ discarded: boolean }>(settings, [
    'discard-upload', '--artifact-sha256', artifactSha256, '--confirm',
  ]);
}

/**
 * Orders independent `schedule status` requests. A later request represents
 * fresher engine truth, so a slow earlier response must not repaint the UI as
 * clean after a newer pending, offline, auth-required, or failed response.
 */
export class ScheduleStatusSequencer {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  apply(request: number, apply: () => void): boolean {
    if (request !== this.generation) return false;
    apply();
    return true;
  }

  invalidate(): void {
    this.generation += 1;
  }
}

/**
 * True when the path points at a capture bundle — `.endstate`, or the legacy
 * `.zip` — case-insensitively. Re-exported from the shared extension module so
 * schedule callers and the import surface can never disagree about what a
 * bundle is.
 */
export { isBundlePath } from './profile-extensions';

/**
 * Resolve the drift-check baseline manifest for a freshly saved capture.
 *
 * Whatever the user saved is the baseline when the engine advertises support
 * for that container. Bundle parsing is additive: schedule-capable engines
 * before 2.28 cannot safely use a `.endstate` or legacy `.zip` path.
 *
 * Older engines therefore fail closed for bundle saves rather than re-arming a
 * task that will fail on its next run. Raw manifest saves remain compatible.
 *
 * @param savePath - Where the user saved the capture (.jsonc or .zip)
 * @returns The path to record as `scheduleManifestPath`.
 */
export function resolveScheduleBaselinePath(
  savePath: string,
  bundleManifestSupported = false,
): string | null {
  return isBundlePath(savePath) && !bundleManifestSupported ? null : savePath;
}

/** A pre-bundle engine may verify raw manifests, but must never be re-armed
 * against a bundle it cannot open. */
export function scheduleBaselineSupported(
  manifestPath: string,
  bundleManifestSupported: boolean,
): boolean {
  return !isBundlePath(manifestPath) || bundleManifestSupported;
}

/**
 * Whether the engine advertises the scheduled drift-check feature.
 *
 * Defaults to FALSE when unknown so the entire scheduled setup checks surface
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

/** `--backup-id` is additive; older engines must not receive the flag. */
export function engineSupportsScheduleBackupId(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  const commands = caps?.commands;
  return (
    commands != null &&
    !Array.isArray(commands) &&
    commands.schedule?.flags?.includes('--backup-id') === true
  );
}

/** Bundle baselines are additive and absent on schedule-capable 2.22–2.27 engines. */
export function engineSupportsScheduleBundleManifest(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  return caps?.features?.schedule?.bundleManifestSupported === true;
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
  | { kind: 'failing'; checkedAt: string }
  | { kind: 'capture-pending'; checkedAt: string }
  | { kind: 'upload-pending'; checkedAt: string }
  | { kind: 'sign-in-required'; checkedAt: string }
  | { kind: 'subscription-required'; checkedAt: string }
  | { kind: 'setup-required'; checkedAt: string }
  | { kind: 'upload-uncertain'; checkedAt: string }
  | { kind: 'upload-failed'; checkedAt: string }
  | { kind: 'offline'; checkedAt: string }
  | { kind: 'local-only'; checkedAt: string };

export function driftStateFromStatus(
  status: ScheduleStatusData | null | undefined,
): DriftChipState {
  // Disabled (or unknown) schedules surface nothing: with no future runs the
  // retained last-run document is stale by definition.
  if (!status?.enabled) return { kind: 'never-run' };

  const lastRun = status.lastRun;
  if (!lastRun) return { kind: 'never-run' };

  // The engine writes `running` as soon as it owns the schedule lock, before
  // capture/verify results exist. Unknown future markers fail closed too, but
  // documented terminal states continue to their actual drift/upload truth.
  if (lastRun.status === 'running' || (
    lastRun.status != null &&
    lastRun.status !== 'completed' &&
    lastRun.status !== 'failed'
  )) {
    return { kind: 'capture-pending', checkedAt: lastRun.timestampUtc };
  }

  if (lastRun.status === 'failed') {
    return { kind: 'failing', checkedAt: lastRun.timestampUtc };
  }

  const pendingUpload = status.pendingUpload;
  const uploadOutcome = pendingUpload?.lastOutcome ?? lastRun.autoBackup?.outcome;
  // A capture may correctly report the drift that caused it even after the
  // upload reaches a terminal, user-actionable outcome. That transfer truth
  // is more current than the pre-capture drift count and must not be hidden.
  if (uploadOutcome === 'setup_required') {
    return { kind: 'setup-required', checkedAt: lastRun.timestampUtc };
  }
  if (uploadOutcome === 'upload_uncertain') {
    return { kind: 'upload-uncertain', checkedAt: lastRun.timestampUtc };
  }

  const count = lastRun.verify?.summary?.fail ?? lastRun.verify?.drifted?.length ?? 0;
  // Drift remains the primary local action while ordinary upload work waits.
  if (count > 0) {
    return { kind: 'drift', count, checkedAt: lastRun.timestampUtc };
  }

  if (lastRun.error) {
    return { kind: 'failing', checkedAt: lastRun.timestampUtc };
  }

  if (uploadOutcome === 'subscription_required') {
    return { kind: 'subscription-required', checkedAt: lastRun.timestampUtc };
  }
  // Older engines do not report whether a scheduled run's local baseline
  // reached Endstate Cloud. Unknown is local-only, never silently current.
  if (!pendingUpload) {
    return { kind: 'local-only', checkedAt: lastRun.timestampUtc };
  }
  if (pendingUpload.pending) {
    if (pendingUpload.lastOutcome === 'auth_required') {
      return { kind: 'sign-in-required', checkedAt: lastRun.timestampUtc };
    }
    if (pendingUpload.lastOutcome === 'error') {
      return { kind: 'upload-failed', checkedAt: lastRun.timestampUtc };
    }
    if (pendingUpload.lastOutcome === 'offline') {
      return { kind: 'offline', checkedAt: lastRun.timestampUtc };
    }
    return { kind: 'upload-pending', checkedAt: lastRun.timestampUtc };
  }
  // Defensively surface a terminal failure even if an engine reports it
  // alongside pending:false rather than treating a local record as healthy.
  if (pendingUpload.lastOutcome === 'auth_required') {
    return { kind: 'sign-in-required', checkedAt: lastRun.timestampUtc };
  }
  if (pendingUpload.lastOutcome === 'error') {
    return { kind: 'upload-failed', checkedAt: lastRun.timestampUtc };
  }
  if (pendingUpload.lastOutcome === 'offline') {
    return { kind: 'offline', checkedAt: lastRun.timestampUtc };
  }
  if (
    pendingUpload.lastOutcome !== 'pushed' &&
    pendingUpload.lastOutcome !== 'skipped'
  ) {
    return { kind: 'local-only', checkedAt: lastRun.timestampUtc };
  }

  return { kind: 'clean', checkedAt: lastRun.timestampUtc };
}
