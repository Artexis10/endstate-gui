import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAutosuiteStreaming } from './streaming-runner';
import { AppSettings } from './settings';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

describe('streaming-runner', () => {
  const mockSettings: AppSettings = {
    engineMode: 'script',
    engineScriptPath: 'C:\\test\\autosuite.ps1',
    customProfilesDirectory: '',
    lastSelectedProfile: '',
    lastSelectedProfilePath: '',
    dryRunEnabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAutosuiteStreaming', () => {
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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'capabilities', [], onEvent);

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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'test', [], onEvent);

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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'test', [], onEvent);

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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'test', [], onEvent);

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
      });

      const onEvent = vi.fn();
      await runAutosuiteStreaming(mockSettings, 'test', [], onEvent);

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
      });

      await runAutosuiteStreaming(pathSettings, 'capabilities', [], vi.fn());

      expect(invoke).toHaveBeenCalledWith(
        'run_autosuite_streaming',
        expect.objectContaining({
          exe: 'autosuite',
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
      });

      await runAutosuiteStreaming(mockSettings, 'verify', ['--profile', 'test.jsonc'], vi.fn());

      expect(invoke).toHaveBeenCalledWith(
        'run_autosuite_streaming',
        expect.objectContaining({
          exe: 'pwsh',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            'C:\\test\\autosuite.ps1',
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
      });

      await runAutosuiteStreaming(mockSettings, 'capture', ['--out', 'C:\\test\\dir'], vi.fn());

      expect(invoke).toHaveBeenCalledWith(
        'run_autosuite_streaming',
        expect.objectContaining({
          exe: 'pwsh',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            'C:\\test\\autosuite.ps1',
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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'test', [], onEvent);

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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'capture', ['--out', 'C:\\profiles\\setup.jsonc'], onEvent);

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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'capture', ['--out', 'C:\\profiles\\setup.jsonc'], onEvent);

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
      });

      const onEvent = vi.fn();
      const result = await runAutosuiteStreaming(mockSettings, 'capture', ['--out', 'C:\\profiles\\setup.jsonc'], onEvent);

      expect(result.envelope).toBeNull();
      expect(result.exitCode).toBe(0);
      // GUI should treat this as success based on exit code
    });
  });
});
