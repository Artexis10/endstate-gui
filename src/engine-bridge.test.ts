import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLogEvent,
  isResultEvent,
  isCliEnvelope,
  isTerminalResult,
  subscribeToEvents,
  engineRun,
  engineCancel,
  engineIsRunning,
  engineGetRunId,
  runCapabilities,
  runVerify,
  runApply,
  EVENT_CHANNEL,
  type LogEvent,
  type ResultEvent,
  type CliEnvelopeEvent,
} from './engine-bridge';
import type { AppSettings } from './settings';

// Mock tauri-bridge
vi.mock('./lib/tauri-bridge', () => ({
  invoke: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
  isEngineAvailable: vi.fn(() => true),
}));

import { invoke, listen } from './lib/tauri-bridge';
const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

const baseSettings: AppSettings = {
  engineMode: 'bundled',
  customProfilesDirectory: '',
  selectedProfileName: null,
  dryRunEnabled: false,
  showDetails: false,
  autoBackupEnabled: false,
  autoBackupPromptSeen: false,
  profileBackupIds: {},
  scheduleEnabled: false,
  scheduleTime: '09:00',
  scheduleAutoPush: false,
  scheduleManifestPath: null,
};

describe('engine-bridge type guards', () => {
  describe('isLogEvent', () => {
    it('returns true for a valid log event', () => {
      const event: LogEvent = { type: 'log', level: 'info', message: 'hello' };
      expect(isLogEvent(event)).toBe(true);
    });

    it('returns false for a result event', () => {
      const event: ResultEvent = {
        type: 'result', ok: true, command: 'verify',
        summary: { exitCode: 0 }, raw: null,
      };
      expect(isLogEvent(event)).toBe(false);
    });

    it('returns false for an envelope event', () => {
      const event: CliEnvelopeEvent = {
        schemaVersion: '1.0', cliVersion: '1.0.0', command: 'capabilities',
        timestampUtc: '2024-01-01', success: true, data: {}, error: null,
      };
      expect(isLogEvent(event)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isLogEvent({})).toBe(false);
    });

    it('returns false when missing level field', () => {
      expect(isLogEvent({ type: 'log', message: 'no level' })).toBe(false);
    });

    it('returns false when missing message field', () => {
      expect(isLogEvent({ type: 'log', level: 'info' })).toBe(false);
    });
  });

  describe('isResultEvent', () => {
    it('returns true for a valid result event', () => {
      const event: ResultEvent = {
        type: 'result', ok: true, command: 'apply',
        summary: { exitCode: 0, total: 5 }, raw: null,
      };
      expect(isResultEvent(event)).toBe(true);
    });

    it('returns true for a failed result event', () => {
      const event: ResultEvent = {
        type: 'result', ok: false, command: 'verify',
        summary: { exitCode: 1, failed: 3 }, raw: null,
      };
      expect(isResultEvent(event)).toBe(true);
    });

    it('returns false for log events', () => {
      const event: LogEvent = { type: 'log', level: 'error', message: 'fail' };
      expect(isResultEvent(event)).toBe(false);
    });

    it('returns false for envelope events', () => {
      const event: CliEnvelopeEvent = {
        schemaVersion: '1.0', cliVersion: '1.0.0', command: 'capabilities',
        timestampUtc: '2024-01-01', success: true, data: {}, error: null,
      };
      expect(isResultEvent(event)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isResultEvent({})).toBe(false);
    });
  });

  describe('isCliEnvelope', () => {
    it('returns true for a valid CLI envelope', () => {
      const event: CliEnvelopeEvent = {
        schemaVersion: '1.0', cliVersion: '1.0.0', command: 'verify',
        timestampUtc: '2024-01-01', success: true, data: { items: [] },
        error: null,
      };
      expect(isCliEnvelope(event)).toBe(true);
    });

    it('returns true for envelope with error', () => {
      const event: CliEnvelopeEvent = {
        schemaVersion: '1.0', cliVersion: '1.0.0', command: 'verify',
        timestampUtc: '2024-01-01', success: false, data: null as any,
        error: { code: 'VERIFY_FAILED', message: 'missing apps' },
      };
      expect(isCliEnvelope(event)).toBe(true);
    });

    it('returns false for log events', () => {
      expect(isCliEnvelope({ type: 'log', level: 'info', message: 'hi' })).toBe(false);
    });

    it('returns false for result events', () => {
      expect(isCliEnvelope({ type: 'result', ok: true, command: 'x', summary: {}, raw: null })).toBe(false);
    });

    it('returns false when missing schemaVersion', () => {
      expect(isCliEnvelope({ success: true, command: 'test' })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isCliEnvelope({})).toBe(false);
    });
  });

  describe('isTerminalResult', () => {
    it('returns true for result events', () => {
      const event: ResultEvent = {
        type: 'result', ok: true, command: 'apply',
        summary: {}, raw: null,
      };
      expect(isTerminalResult(event)).toBe(true);
    });

    it('returns true for CLI envelopes', () => {
      const event: CliEnvelopeEvent = {
        schemaVersion: '1.0', cliVersion: '1.0.0', command: 'verify',
        timestampUtc: '2024-01-01', success: true, data: {}, error: null,
      };
      expect(isTerminalResult(event)).toBe(true);
    });

    it('returns false for log events', () => {
      const event: LogEvent = { type: 'log', level: 'info', message: 'hi' };
      expect(isTerminalResult(event)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isTerminalResult({})).toBe(false);
    });
  });
});

describe('engine-bridge functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribeToEvents', () => {
    it('calls listen with the event channel', async () => {
      const callback = vi.fn();
      const mockUnlisten = vi.fn();
      mockListen.mockResolvedValue(mockUnlisten);

      const unlisten = await subscribeToEvents(callback);

      expect(mockListen).toHaveBeenCalledWith(EVENT_CHANNEL, expect.any(Function));
      expect(unlisten).toBe(mockUnlisten);
    });

    it('passes event payload to callback', async () => {
      const callback = vi.fn();
      let capturedHandler: ((event: { payload: unknown }) => void) | undefined;
      mockListen.mockImplementation(async (_event, handler) => {
        capturedHandler = handler as any;
        return () => {};
      });

      await subscribeToEvents(callback);

      const testEvent: LogEvent = { type: 'log', level: 'info', message: 'test' };
      capturedHandler!({ payload: testEvent });

      expect(callback).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('engineRun', () => {
    it('invokes engine_run with exe and args', async () => {
      mockInvoke.mockResolvedValue('run-123');

      const runId = await engineRun('endstate', ['verify', '--json']);

      expect(mockInvoke).toHaveBeenCalledWith('engine_run', {
        exe: 'endstate',
        args: ['verify', '--json'],
      });
      expect(runId).toBe('run-123');
    });
  });

  describe('engineCancel', () => {
    it('invokes engine_cancel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await engineCancel();
      expect(mockInvoke).toHaveBeenCalledWith('engine_cancel');
    });
  });

  describe('engineIsRunning', () => {
    it('returns true when run is active', async () => {
      mockInvoke.mockResolvedValue(true);
      const running = await engineIsRunning();
      expect(running).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('engine_is_running');
    });

    it('returns false when no run is active', async () => {
      mockInvoke.mockResolvedValue(false);
      const running = await engineIsRunning();
      expect(running).toBe(false);
    });
  });

  describe('engineGetRunId', () => {
    it('returns runId when active', async () => {
      mockInvoke.mockResolvedValue('run-456');
      const runId = await engineGetRunId();
      expect(runId).toBe('run-456');
      expect(mockInvoke).toHaveBeenCalledWith('engine_get_run_id');
    });

    it('returns null when no run active', async () => {
      mockInvoke.mockResolvedValue(null);
      const runId = await engineGetRunId();
      expect(runId).toBeNull();
    });
  });

  describe('runCapabilities', () => {
    it('builds command and starts engine run', async () => {
      mockInvoke.mockResolvedValue('run-cap-1');

      const runId = await runCapabilities(baseSettings);

      expect(mockInvoke).toHaveBeenCalledWith('engine_run', {
        exe: '__bundled__',
        args: ['capabilities', '-Json'],
      });
      expect(runId).toBe('run-cap-1');
    });
  });

  describe('runVerify', () => {
    it('builds command with manifest path', async () => {
      mockInvoke.mockResolvedValue('run-v-1');

      const runId = await runVerify(baseSettings, 'C:\\profiles\\test.jsonc');

      expect(mockInvoke).toHaveBeenCalledWith('engine_run', {
        exe: '__bundled__',
        args: ['verify', 'C:\\profiles\\test.jsonc', '-Json'],
      });
      expect(runId).toBe('run-v-1');
    });
  });

  describe('runApply', () => {
    it('builds command with manifest path', async () => {
      mockInvoke.mockResolvedValue('run-a-1');

      const runId = await runApply(baseSettings, 'C:\\profiles\\setup.jsonc');

      expect(mockInvoke).toHaveBeenCalledWith('engine_run', {
        exe: '__bundled__',
        args: ['apply', 'C:\\profiles\\setup.jsonc', '-Json'],
      });
      expect(runId).toBe('run-a-1');
    });

    it('uses path mode when configured', async () => {
      const pathSettings: AppSettings = {
        ...baseSettings,
        engineMode: 'path',
      };
      mockInvoke.mockResolvedValue('run-a-2');

      await runApply(pathSettings, 'C:\\profiles\\setup.jsonc');

      expect(mockInvoke).toHaveBeenCalledWith('engine_run', {
        exe: 'endstate',
        args: ['apply', 'C:\\profiles\\setup.jsonc', '-Json'],
      });
    });
  });
});
