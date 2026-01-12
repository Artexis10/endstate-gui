import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runEndstateStreaming } from './streaming-runner';
import { AppSettings } from './settings';
import { invoke, listen } from './lib/tauri-bridge';

vi.mock('./lib/tauri-bridge', () => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
}));

vi.mock('./lib/engine-path', () => ({
  validateEngineScriptPath: vi.fn(() => Promise.resolve(null)),
  getRepoRootFromScriptPath: vi.fn(() => null),
}));

describe('streaming-runner', () => {
  const mockSettings: AppSettings = {
    engineMode: 'script',
    engineScriptPath: 'C:\\test\\endstate.ps1',
    customProfilesDirectory: '',
    lastSelectedProfile: '',
    lastSelectedProfilePath: '',
    dryRunEnabled: true,
    showDetails: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runEndstateStreaming', () => {
    it('parses valid JSON envelope from stdout', async () => {
      const mockEnvelope = {
        schemaVersion: '1.0',
        cliVersion: '1.0.0',
        command: 'capabilities',
        runId: 'test-run',
        timestampUtc: '2025-01-01T00:00:00Z',
        success: true,
        data: { test: 'data' },
        error: null,
      };

      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stdout', data: JSON.stringify(mockEnvelope) } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true; // Indicate Tauri streaming is available
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'capabilities', [], onEvent);

      expect(result.envelope).toEqual(mockEnvelope);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(JSON.stringify(mockEnvelope));
    });

    it('returns null envelope when stdout is not JSON', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stdout', data: 'Not JSON output' } });
        eventCallback({ payload: { type: 'exit', exitCode: 1 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'test', [], onEvent);

      expect(result.envelope).toBeNull();
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('Not JSON output');
    });

    it('returns null envelope when stdout is empty', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'test', [], onEvent);

      expect(result.envelope).toBeNull();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('captures stderr separately from stdout', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stderr', data: 'Error message\n' } });
        eventCallback({ payload: { type: 'stdout', data: '{"test": true}' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'test', [], onEvent);

      expect(result.stderr).toBe('Error message\n');
      expect(result.stdout).toBe('{"test": true}');
    });

    it('calls onEvent callback for each stream event', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stdout', data: 'line1\n' } });
        eventCallback({ payload: { type: 'stderr', data: 'error1\n' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      await runEndstateStreaming(mockSettings, 'test', [], onEvent);

      expect(onEvent).toHaveBeenCalledTimes(3);
      expect(onEvent).toHaveBeenCalledWith({ type: 'stdout', data: 'line1\n' });
      expect(onEvent).toHaveBeenCalledWith({ type: 'stderr', data: 'error1\n' });
      expect(onEvent).toHaveBeenCalledWith({ type: 'exit', exitCode: 0 });
    });

    it('uses PATH mode when engineMode is path', async () => {
      const pathSettings: AppSettings = {
        ...mockSettings,
        engineMode: 'path',
      };

      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      await runEndstateStreaming(pathSettings, 'capabilities', [], vi.fn());

      expect(invoke).toHaveBeenCalledWith(
        'run_endstate_streaming',
        expect.objectContaining({
          exe: 'endstate',
          args: ['capabilities', '--json'],
        })
      );
    });

    it('uses script mode with pwsh when engineMode is script', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      await runEndstateStreaming(mockSettings, 'verify', ['--profile', 'test.jsonc'], vi.fn());

      expect(invoke).toHaveBeenCalledWith(
        'run_endstate_streaming',
        expect.objectContaining({
          exe: 'pwsh',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            'C:\\test\\endstate.ps1',
            'verify',
            '--json',
            '--profile',
            'test.jsonc',
          ],
        })
      );
    });

    it('adds --json exactly once for capture command', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      await runEndstateStreaming(mockSettings, 'capture', ['--out', 'C:\\test\\dir'], vi.fn());

      expect(invoke).toHaveBeenCalledWith(
        'run_endstate_streaming',
        expect.objectContaining({
          exe: 'pwsh',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            'C:\\test\\endstate.ps1',
            'capture',
            '--json',
            '--out',
            'C:\\test\\dir',
          ],
        })
      );
    });

    it('returns null envelope for malformed JSON', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stdout', data: '{invalid json}' } });
        eventCallback({ payload: { type: 'exit', exitCode: 1 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'test', [], onEvent);

      expect(result.envelope).toBeNull();
      expect(result.stdout).toBe('{invalid json}');
    });

    it('should extract JSON envelope from mixed stdout (logs + JSON)', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ 
          payload: { 
            type: 'stdout', 
            data: '[INFO] Starting capture...\n[INFO] Processing...\n{"schemaVersion":"1.0","command":"capture","success":true,"data":{"outputPath":"C:\\\\profiles\\\\setup.jsonc"},"error":null}' 
          } 
        });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'capture', ['--out', 'C:\\profiles\\setup.jsonc'], onEvent);

      expect(result.envelope).not.toBeNull();
      expect(result.envelope?.success).toBe(true);
      expect(result.envelope?.data).toHaveProperty('outputPath');
    });

    it('should extract multi-line JSON envelope from stdout', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      const multiLineEnvelope = `[INFO] Starting capture...
[INFO] Processing...
{
  "schemaVersion": "1.0",
  "command": "capture",
  "success": true,
  "data": {
    "outputPath": "C:\\\\profiles\\\\setup.jsonc"
  },
  "error": null
}`;

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stdout', data: multiLineEnvelope } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'capture', ['--out', 'C:\\profiles\\setup.jsonc'], onEvent);

      expect(result.envelope).not.toBeNull();
      expect(result.envelope?.success).toBe(true);
      expect(result.envelope?.data).toHaveProperty('outputPath');
    });

    it('should treat exit code 0 as success when no envelope is parsed', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stdout', data: '[INFO] Capture completed successfully' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      const result = await runEndstateStreaming(mockSettings, 'capture', ['--out', 'C:\\profiles\\setup.jsonc'], onEvent);

      expect(result.envelope).toBeNull();
      expect(result.exitCode).toBe(0);
      // GUI should treat this as success based on exit code
    });

    it('includes --events jsonl when enableNdjsonEvents is true', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        vi.fn(),
        { enableNdjsonEvents: true }
      );

      expect(invoke).toHaveBeenCalledWith(
        'run_endstate_streaming',
        expect.objectContaining({
          exe: 'pwsh',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            'C:\\test\\endstate.ps1',
            'apply',
            '--json',
            '--events',
            'jsonl',
            '--profile',
            'test.jsonc',
          ],
        })
      );
    });

    it('parses NDJSON events from stderr when enableNdjsonEvents is true', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      const ndjsonEvents = [
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"item","id":"App.Test","driver":"winget","status":"installing","reason":null,"timestamp":"2025-01-01T00:00:01.000Z"}',
        '{"version":1,"event":"item","id":"App.Test","driver":"winget","status":"installed","reason":null,"timestamp":"2025-01-01T00:00:02.000Z"}',
        '{"version":1,"event":"summary","phase":"apply","total":1,"success":1,"skipped":0,"failed":0,"timestamp":"2025-01-01T00:00:03.000Z"}',
      ];

      vi.mocked(invoke).mockImplementation(async () => {
        // Emit NDJSON events to stderr
        for (const line of ndjsonEvents) {
          eventCallback({ payload: { type: 'stderr', data: line + '\n' } });
        }
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onEvent = vi.fn();
      const onNdjsonEvent = vi.fn();
      const result = await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        onEvent,
        { enableNdjsonEvents: true, onNdjsonEvent }
      );

      expect(result.ndjsonEvents).toHaveLength(4);
      expect(onNdjsonEvent).toHaveBeenCalledTimes(4);
      
      // Verify event types
      expect(result.ndjsonEvents[0]).toMatchObject({ event: 'phase', phase: 'apply' });
      expect(result.ndjsonEvents[1]).toMatchObject({ event: 'item', id: 'App.Test', status: 'installing' });
      expect(result.ndjsonEvents[2]).toMatchObject({ event: 'item', id: 'App.Test', status: 'installed' });
      expect(result.ndjsonEvents[3]).toMatchObject({ event: 'summary', phase: 'apply', total: 1, success: 1 });
    });

    it('handles chunked NDJSON events split across stderr chunks', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        // Emit partial JSON line in first chunk
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"phase","phase":"ap' } });
        // Complete the line in second chunk
        eventCallback({ payload: { type: 'stderr', data: 'ply","timestamp":"2025-01-01T00:00:00.000Z"}\n' } });
        // Full event in third chunk
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"summary","phase":"apply","total":1,"success":1,"skipped":0,"failed":0,"timestamp":"2025-01-01T00:00:01.000Z"}\n' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onNdjsonEvent = vi.fn();
      const result = await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        vi.fn(),
        { enableNdjsonEvents: true, onNdjsonEvent }
      );

      expect(result.ndjsonEvents).toHaveLength(2);
      expect(onNdjsonEvent).toHaveBeenCalledTimes(2);
      expect(result.ndjsonEvents[0]).toMatchObject({ event: 'phase', phase: 'apply' });
      expect(result.ndjsonEvents[1]).toMatchObject({ event: 'summary', phase: 'apply' });
    });

    it('handles Windows CRLF line endings in NDJSON events', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        // Emit NDJSON with CRLF endings
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\r\n' } });
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"summary","phase":"apply","total":1,"success":1,"skipped":0,"failed":0,"timestamp":"2025-01-01T00:00:01.000Z"}\r\n' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onNdjsonEvent = vi.fn();
      const result = await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        vi.fn(),
        { enableNdjsonEvents: true, onNdjsonEvent }
      );

      expect(result.ndjsonEvents).toHaveLength(2);
      expect(result.ndjsonEvents[0]).toMatchObject({ event: 'phase', phase: 'apply' });
      expect(result.ndjsonEvents[1]).toMatchObject({ event: 'summary', phase: 'apply' });
    });

    it('ignores non-JSON lines in stderr when parsing NDJSON events', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        // Mix valid NDJSON with plain text logs
        eventCallback({ payload: { type: 'stderr', data: '[INFO] Starting apply...\n' } });
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\n' } });
        eventCallback({ payload: { type: 'stderr', data: '[DEBUG] Processing item...\n' } });
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"summary","phase":"apply","total":1,"success":1,"skipped":0,"failed":0,"timestamp":"2025-01-01T00:00:01.000Z"}\n' } });
        eventCallback({ payload: { type: 'stderr', data: '[INFO] Apply complete\n' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onNdjsonEvent = vi.fn();
      const result = await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        vi.fn(),
        { enableNdjsonEvents: true, onNdjsonEvent }
      );

      // Should only parse the 2 valid NDJSON events, ignoring plain text
      expect(result.ndjsonEvents).toHaveLength(2);
      expect(onNdjsonEvent).toHaveBeenCalledTimes(2);
      
      // Stderr should still contain all lines
      expect(result.stderr).toContain('[INFO] Starting apply...');
      expect(result.stderr).toContain('[DEBUG] Processing item...');
      expect(result.stderr).toContain('[INFO] Apply complete');
    });

    it('flushes remaining partial NDJSON event on exit', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        // Emit complete event
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\n' } });
        // Emit partial event without newline (simulates process killed mid-output)
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"summary","phase":"apply","total":1,"success":1,"skipped":0,"failed":0,"timestamp":"2025-01-01T00:00:01.000Z"}' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onNdjsonEvent = vi.fn();
      const result = await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        vi.fn(),
        { enableNdjsonEvents: true, onNdjsonEvent }
      );

      // Should parse both events: one from newline, one from flush
      expect(result.ndjsonEvents).toHaveLength(2);
      expect(result.ndjsonEvents[0]).toMatchObject({ event: 'phase' });
      expect(result.ndjsonEvents[1]).toMatchObject({ event: 'summary' });
    });

    it('does not parse NDJSON when enableNdjsonEvents is false', async () => {
      const mockUnlisten = vi.fn();
      let eventCallback: (event: any) => void = () => {};

      vi.mocked(listen).mockImplementation(async (_channel, callback) => {
        eventCallback = callback;
        return mockUnlisten;
      });

      vi.mocked(invoke).mockImplementation(async () => {
        eventCallback({ payload: { type: 'stderr', data: '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\n' } });
        eventCallback({ payload: { type: 'exit', exitCode: 0 } });
        return true;
      });

      const onNdjsonEvent = vi.fn();
      const result = await runEndstateStreaming(
        mockSettings,
        'apply',
        ['--profile', 'test.jsonc'],
        vi.fn(),
        { enableNdjsonEvents: false, onNdjsonEvent }
      );

      expect(result.ndjsonEvents).toHaveLength(0);
      expect(onNdjsonEvent).not.toHaveBeenCalled();
      // Stderr should still be captured
      expect(result.stderr).toContain('{"version":1');
    });
  });
});
