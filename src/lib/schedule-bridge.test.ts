import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();
vi.mock('./engine-exec', () => ({
  runEndstateOnce: (...args: unknown[]) => execMock(...args),
}));

import {
  scheduleEnable,
  scheduleDisable,
  scheduleStatus,
  engineSupportsSchedule,
  engineSupportsScheduleAutoPush,
  driftStateFromStatus,
  ScheduleCommandError,
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

  it('appends --auto-push when autoPush is set', async () => {
    execMock.mockResolvedValue(okResult({ enabled: true }));
    await scheduleEnable(SETTINGS, { manifest: 'C:\\snap.zip', autoPush: true });
    expect(cliArgs()).toContain('--auto-push');
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

  it('maps a clean run (fail = 0) to clean', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: false,
        lastRun: {
          ...baseRun,
          verify: { summary: { total: 10, pass: 10, fail: 0 }, drifted: [] },
        },
      }),
    ).toEqual({ kind: 'clean', checkedAt: '2026-07-10T09:00:00Z' });
  });

  it('maps drifted items to drift with the fail count', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: false,
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

  it('maps a hard error to failing (drift chip suppressed)', () => {
    expect(
      driftStateFromStatus({
        enabled: true,
        autoPush: false,
        lastRun: {
          ...baseRun,
          error: { code: 'MANIFEST_NOT_FOUND', message: 'manifest missing' },
        },
      }),
    ).toEqual({ kind: 'failing', checkedAt: '2026-07-10T09:00:00Z' });
  });
});
