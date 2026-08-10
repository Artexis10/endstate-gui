import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();
vi.mock('./engine-exec', () => ({
  runEndstateOnce: (...args: unknown[]) => execMock(...args),
}));

import {
  scheduleEnable,
  scheduleDisable,
  scheduleDiscardUpload,
  scheduleStatus,
  engineSupportsSchedule,
  engineSupportsScheduleAutoPush,
  engineSupportsScheduleBackupId,
  engineSupportsScheduleBundleManifest,
  driftStateFromStatus,
  isBundlePath,
  resolveScheduleBaselinePath,
  ScheduleCommandError,
  ScheduleStatusSequencer,
} from './schedule-bridge';
import type { AppSettings } from '../settings';
import type { EndstateCapabilitiesData, ScheduleStatusData } from '../types';

const SETTINGS = {} as AppSettings;

function okResult<T>(data: T) {
  return {
    success: true,
    envelope: { success: true, data, error: null },
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
}

function cliArgs(): string[] {
  return execMock.mock.calls[0][2] as string[];
}

beforeEach(() => {
  execMock.mockReset();
});

describe('scheduleEnable', () => {
  it('passes --manifest and --time; omits --auto-push by default', async () => {
    execMock.mockResolvedValue(okResult({ enabled: true }));
    await scheduleEnable(SETTINGS, { manifest: 'C:\\snap.zip', time: '09:00' });
    expect(execMock.mock.calls[0][1]).toBe('schedule');
    expect(cliArgs()).toEqual(['enable', '--manifest', 'C:\\snap.zip', '--time', '09:00']);
  });

  it('reasserts a saved bundle path unchanged when repairing a scheduled task', async () => {
    execMock.mockResolvedValue(okResult({ enabled: true }));

    await scheduleEnable(SETTINGS, {
      manifest: 'C:\\captures\\saved.endstate',
      time: '09:00',
    });

    expect(cliArgs()).toEqual([
      'enable', '--manifest', 'C:\\captures\\saved.endstate', '--time', '09:00',
    ]);
  });

  it('appends --auto-push when autoPush is set', async () => {
    execMock.mockResolvedValue(okResult({ enabled: true }));
    await scheduleEnable(SETTINGS, { manifest: 'C:\\snap.zip', autoPush: true });
    expect(cliArgs()).toContain('--auto-push');
  });

  it('passes a known backup id without guessing another mapping', async () => {
    execMock.mockResolvedValue(okResult({ enabled: true }));
    await scheduleEnable(SETTINGS, {
      manifest: 'C:\\captures\\work.jsonc',
      backupId: 'backup-work',
    });
    expect(cliArgs()).toEqual([
      'enable', '--manifest', 'C:\\captures\\work.jsonc', '--backup-id', 'backup-work',
    ]);
  });

  it('passes --interval when provided', async () => {
    execMock.mockResolvedValue(okResult({ enabled: true }));
    await scheduleEnable(SETTINGS, { manifest: 'C:\\snap.zip', interval: 'weekly' });
    expect(cliArgs()).toEqual(
      expect.arrayContaining(['--interval', 'weekly']),
    );
  });

  it('throws ScheduleCommandError with the engine error code', async () => {
    execMock.mockResolvedValue({
      success: false,
      error: { kind: 'command_failed', message: 'failed' },
      envelope: {
        success: false,
        data: null,
        error: {
          code: 'MANIFEST_NOT_FOUND',
          message: 'The specified manifest file does not exist.',
        },
      },
    });
    await expect(
      scheduleEnable(SETTINGS, { manifest: 'C:\\missing.zip' }),
    ).rejects.toMatchObject({
      name: 'ScheduleCommandError',
      code: 'MANIFEST_NOT_FOUND',
    });
  });

  it('wraps runtime failures (no envelope) with the error kind as code', async () => {
    execMock.mockResolvedValue({
      success: false,
      error: { kind: 'command_not_found', message: 'endstate not found' },
    });
    await expect(
      scheduleEnable(SETTINGS, { manifest: 'C:\\snap.zip' }),
    ).rejects.toMatchObject({ code: 'COMMAND_NOT_FOUND' });
  });
});

describe('scheduleDisable / scheduleStatus', () => {
  it('scheduleDisable passes the disable subcommand', async () => {
    execMock.mockResolvedValue(okResult({ enabled: false }));
    await scheduleDisable(SETTINGS);
    expect(cliArgs()).toEqual(['disable']);
  });

  it('scheduleStatus passes the status subcommand and returns data', async () => {
    const status: ScheduleStatusData = { enabled: true, autoPush: false, lastRun: null };
    execMock.mockResolvedValue(okResult(status));
    const result = await scheduleStatus(SETTINGS);
    expect(cliArgs()).toEqual(['status']);
    expect(result).toEqual(status);
  });

  it('scheduleStatus surfaces envelope-level failure as ScheduleCommandError', async () => {
    execMock.mockResolvedValue({
      success: true,
      envelope: {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'boom' },
      },
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await expect(scheduleStatus(SETTINGS)).rejects.toBeInstanceOf(ScheduleCommandError);
  });

  it('discards only the explicitly confirmed ambiguous upload artifact', async () => {
    execMock.mockResolvedValue(okResult({ discarded: true }));
    await scheduleDiscardUpload(SETTINGS, 'sha256:ambiguous');
    expect(cliArgs()).toEqual([
      'discard-upload', '--artifact-sha256', 'sha256:ambiguous', '--confirm',
    ]);
  });
});

describe('engineSupportsSchedule', () => {
  it('defaults FALSE when capabilities are missing', () => {
    expect(engineSupportsSchedule(null)).toBe(false);
    expect(engineSupportsSchedule(undefined)).toBe(false);
    expect(engineSupportsSchedule({} as EndstateCapabilitiesData)).toBe(false);
  });

  it('is FALSE when the engine predates the schedule feature (bundled 2.21)', () => {
    const caps: EndstateCapabilitiesData = {
      features: { hostedBackup: { supported: true } },
    };
    expect(engineSupportsSchedule(caps)).toBe(false);
    expect(engineSupportsScheduleAutoPush(caps)).toBe(false);
  });

  it('is TRUE only when features.schedule.supported is true', () => {
    expect(
      engineSupportsSchedule({
        features: { schedule: { supported: true, autoPush: false } },
      }),
    ).toBe(true);
    expect(
      engineSupportsSchedule({
        features: { schedule: { supported: false, autoPush: true } },
      }),
    ).toBe(false);
  });

  it('autoPush probe reads features.schedule.autoPush independently', () => {
    expect(
      engineSupportsScheduleAutoPush({
        features: { schedule: { supported: true, autoPush: true } },
      }),
    ).toBe(true);
    expect(
      engineSupportsScheduleAutoPush({
        features: { schedule: { supported: true, autoPush: false } },
      }),
    ).toBe(false);
  });

  it('requires the additive schedule backup-id flag', () => {
    expect(engineSupportsScheduleBackupId({
      commands: { schedule: { flags: [] } },
      features: { schedule: { supported: true, autoPush: true } },
    })).toBe(false);
    expect(engineSupportsScheduleBackupId({
      commands: { schedule: { flags: ['--backup-id'] } },
      features: { schedule: { supported: true, autoPush: true } },
    })).toBe(true);
  });

  it('requires the additive bundle-manifest capability for bundle baselines', () => {
    expect(engineSupportsScheduleBundleManifest({
      features: { schedule: { supported: true, autoPush: false } },
    })).toBe(false);
    expect(engineSupportsScheduleBundleManifest({
      features: { schedule: { supported: true, autoPush: false, bundleManifestSupported: true } },
    })).toBe(true);
  });
});

describe('driftStateFromStatus', () => {
  const baseRun = {
    schemaVersion: '1.0',
    runId: 'schedule-20260710-090000',
    timestampUtc: '2026-07-10T09:00:00Z',
  };

  it('maps missing status to never-run', () => {
    expect(driftStateFromStatus(null)).toEqual({ kind: 'never-run' });
    expect(driftStateFromStatus(undefined)).toEqual({ kind: 'never-run' });
  });

  it.each(['running', 'future_terminal_state'])('fails closed for a %s last-run marker', (status) => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        pendingUpload: { pending: false, lastOutcome: 'pushed' },
        lastRun: {
          ...baseRun,
          status,
          verify: { summary: { total: 2, pass: 0, fail: 2 } },
        },
      }),
    ).toEqual({ kind: 'capture-pending', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('continues completed runs through ordinary drift mapping', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        lastRun: {
          ...baseRun,
          status: 'completed',
          verify: { summary: { total: 2, pass: 0, fail: 2 } },
        },
      }),
    ).toEqual({ kind: 'drift', count: 2, checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps a failed run to failing even when the engine omitted error details', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        lastRun: {
          ...baseRun,
          status: 'failed',
          verify: { summary: { total: 2, pass: 2, fail: 0 } },
        },
      }),
    ).toEqual({ kind: 'failing', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps enabled-but-never-run (lastRun null) to never-run', () => {
    expect(
      driftStateFromStatus({ enabled: true, autoPush: false, lastRun: null }),
    ).toEqual({ kind: 'never-run' });
  });

  it('maps a disabled schedule to never-run even with a retained lastRun', () => {
    expect(
      driftStateFromStatus({
        enabled: false,
        autoPush: false,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 8, fail: 2 } },
        },
      }),
    ).toEqual({ kind: 'never-run' });
  });

  it('treats an older engine without pending-upload truth as local only', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: false,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 10, fail: 0 }, drifted: [] },
        },
      }),
    ).toEqual({ kind: 'local-only', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it.each([
    ['pending', { pending: true }, 'upload-pending'],
    ['sign-in required', { pending: true, lastOutcome: 'auth_required' }, 'sign-in-required'],
    ['retryable upload failure', { pending: true, lastOutcome: 'error' }, 'upload-failed'],
    ['subscription required', { pending: true, lastOutcome: 'subscription_required' }, 'subscription-required'],
    ['setup required', { pending: true, lastOutcome: 'setup_required' }, 'setup-required'],
    ['uncertain upload', { pending: true, lastOutcome: 'upload_uncertain' }, 'upload-uncertain'],
    ['offline upload retry', { pending: true, lastOutcome: 'offline' }, 'offline'],
  ] as const)('maps %s upload state without calling it current', (_label, pendingUpload, kind) => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        pendingUpload,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 10, fail: 0 }, drifted: [] },
        },
      }),
    ).toEqual({ kind, checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps an auto-backup subscription requirement even when older status omits pendingUpload', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 10, fail: 0 }, drifted: [] },
          autoBackup: { outcome: 'subscription_required' },
        },
      }),
    ).toEqual({ kind: 'subscription-required', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps an auto-backup setup requirement without falling back to generic pending', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 1, pass: 1, fail: 0 } },
          autoBackup: { outcome: 'setup_required' },
        },
      }),
    ).toEqual({ kind: 'setup-required', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps an uncertain auto-backup upload without treating it as retryable pending', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 1, pass: 1, fail: 0 } },
          autoBackup: { outcome: 'upload_uncertain' },
        },
      }),
    ).toEqual({ kind: 'upload-uncertain', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it.each([
    ['setup_required', 'setup-required'],
    ['upload_uncertain', 'upload-uncertain'],
  ] as const)('gives terminal %s upload truth precedence over detected drift', (outcome, kind) => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        pendingUpload: { pending: true, lastOutcome: outcome },
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 2, pass: 0, fail: 2 } },
        },
      }),
    ).toEqual({ kind, checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('preserves an additive queued-upload count for callers that need honest aggregate copy', () => {
    const status: ScheduleStatusData = {
      enabled: true,
      autoPush: true,
      pendingUpload: { pending: true, count: 3, lastOutcome: 'offline' },
      lastRun: {
        ...baseRun,
        verify: { summary: { total: 10, pass: 10, fail: 0 }, drifted: [] },
      },
    };

    expect(status.pendingUpload?.count).toBe(3);
    expect(driftStateFromStatus(status)).toEqual({ kind: 'offline', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('treats a present but outcome-less upload field as local only', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        pendingUpload: { pending: false },
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 10, fail: 0 }, drifted: [] },
        },
      }),
    ).toEqual({ kind: 'local-only', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps drifted items to drift with the fail count', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: false,
        pendingUpload: { pending: false, lastOutcome: 'pushed' },
        lastRun: {
          ...baseRun,
          verify: {
            summary: { total: 10, pass: 9, fail: 1 },
            drifted: [
              { id: 'vscode', name: 'Visual Studio Code', status: 'fail', reason: 'missing' },
            ],
          },
        },
      }),
    ).toEqual({ kind: 'drift', count: 1, checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('keeps drift actionable when an upload is also pending', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: true,
        pendingUpload: { pending: true, lastOutcome: 'offline' },
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 8, fail: 2 } },
        },
      }),
    ).toEqual({ kind: 'drift', count: 2, checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps a hard error to failing (drift chip suppressed)', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: false,
        pendingUpload: { pending: false, lastOutcome: 'pushed' },
        lastRun: {
          ...baseRun,
          error: { code: 'MANIFEST_NOT_FOUND', message: 'manifest missing' },
        },
      }),
    ).toEqual({ kind: 'failing', checkedAt: '2026-07-10T09:00:00Z' });
  });
});

describe('ScheduleStatusSequencer', () => {
  it('rejects an older delayed clean response after newer offline truth is applied', () => {
    const sequencer = new ScheduleStatusSequencer();
    const older = sequencer.begin();
    const newer = sequencer.begin();
    const applied: string[] = [];

    expect(sequencer.apply(newer, () => applied.push('offline'))).toBe(true);
    expect(sequencer.apply(older, () => applied.push('clean'))).toBe(false);
    expect(applied).toEqual(['offline']);
  });
});

describe('isBundlePath', () => {
  it('detects the legacy .zip extension case-insensitively', () => {
    expect(isBundlePath('C:\snap.zip')).toBe(true);
    expect(isBundlePath('C:\SNAP.ZIP')).toBe(true);
    expect(isBundlePath('C:\snap.Zip ')).toBe(true);
  });

  it('detects the .endstate extension case-insensitively', () => {
    expect(isBundlePath('C:\snap.endstate')).toBe(true);
    expect(isBundlePath('C:\SNAP.ENDSTATE')).toBe(true);
    expect(isBundlePath('C:\snap.EndState ')).toBe(true);
  });

  it('rejects paths that are not bundles', () => {
    expect(isBundlePath('C:\snap.jsonc')).toBe(false);
    expect(isBundlePath('C:\snap.zip.manifest.jsonc')).toBe(false);
    expect(isBundlePath('C:\snap.endstate.manifest.jsonc')).toBe(false);
    expect(isBundlePath('C:\zip')).toBe(false);
    expect(isBundlePath('C:\endstate')).toBe(false);
  });
});

describe('resolveScheduleBaselinePath', () => {
  // These tests previously pinned the opposite invariant — "never resolves to a
  // .zip path" — because the engine's loader parsed raw JSONC only, so a bundle
  // could not be a baseline and the GUI side-wrote
  // `<bundle>.zip.manifest.jsonc` beside every saved bundle. Engine 2.28.0
  // reads manifest.jsonc out of the bundle (Artexis10/endstate#194), so the
  // saved file is the baseline and there is no second file to keep paired
  // with it.

  it('returns a manifest-only save unchanged', () => {
    expect(resolveScheduleBaselinePath('C:\\captures\\snap.jsonc')).toBe(
      'C:\\captures\\snap.jsonc',
    );
  });

  it('records a saved bundle directly only when the engine advertises bundle support', () => {
    const resolved = resolveScheduleBaselinePath('C:\\captures\\snap.zip', true);

    expect(resolved).toBe('C:\\captures\\snap.zip');
    expect(resolved).not.toContain('.manifest.jsonc');
  });

  it('fails closed for a bundle on an older schedule-capable engine', () => {
    expect(resolveScheduleBaselinePath('C:\\captures\\snap.endstate', false)).toBeNull();
    expect(resolveScheduleBaselinePath('C:\\captures\\snap.zip', false)).toBeNull();
  });

  it('records raw manifests regardless of bundle capability', () => {
    for (const savePath of [
      'C:\\captures\\snap.jsonc',
    ]) {
      expect(resolveScheduleBaselinePath(savePath)).toBe(savePath);
    }
  });
});
