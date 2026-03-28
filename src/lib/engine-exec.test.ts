import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEngineCommand, runEndstateOnce, getErrorMessage, type EngineError } from './engine-exec';
import { AppSettings } from '../settings';

// Mock the tauri-bridge invoke function
vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
  isEngineAvailable: vi.fn(() => true),
}));

// Mock engine-path for script validation
vi.mock('./engine-path', () => ({
  validateEngineScriptPath: vi.fn().mockResolvedValue(null),
  getRepoRootFromScriptPath: vi.fn().mockReturnValue(null),
}));

import { invoke, isEngineAvailable } from './tauri-bridge';
import { validateEngineScriptPath } from './engine-path';
const mockInvoke = vi.mocked(invoke);
const mockIsEngineAvailable = vi.mocked(isEngineAvailable);
const mockValidateScriptPath = vi.mocked(validateEngineScriptPath);

describe('buildEngineCommand', () => {
  const baseSettings: AppSettings = {
    engineMode: 'bundled',
    engineScriptPath: '',
    customProfilesDirectory: '',
    selectedProfileName: null,
    dryRunEnabled: false,
    showDetails: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('script mode', () => {
    it('returns pwsh with -File flag for script mode', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\Users\\test\\endstate\\bin\\endstate.ps1',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.exe).toBe('pwsh');
      expect(result.args).toEqual([
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'C:\\Users\\test\\endstate\\bin\\endstate.ps1',
        'capabilities',
        '--json',
      ]);
      expect(result.displayCommand).toContain('pwsh');
      expect(result.displayCommand).toContain('-File');
      expect(result.displayCommand).toContain('endstate.ps1');
    });

    it('includes all command args after script path', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\endstate.ps1',
      };

      const result = await buildEngineCommand(settings, ['verify', '--json', '--profile', 'test.jsonc']);

      expect(result.args).toEqual([
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        'C:\\test\\endstate.ps1',
        'verify',
        '--json',
        '--profile',
        'test.jsonc',
      ]);
    });

    it('displayCommand shows quoted script path', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\path with spaces\\endstate.ps1',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.displayCommand).toContain('"C:\\path with spaces\\endstate.ps1"');
    });
  });

  describe('bundled mode', () => {
    it('passes __bundled__ sentinel to Rust for sidecar resolution', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.exe).toBe('__bundled__');
      expect(result.args).toEqual(['capabilities', '--json']);
      expect(result.displayCommand).toBe('[bundled] capabilities --json');
      // Should NOT call get_bundled_engine_path — resolution is in Rust
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('path mode', () => {
    it('returns endstate exe for path mode', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'path',
      };

      const result = await buildEngineCommand(settings, ['verify', '--json', '--profile', 'test.jsonc']);

      expect(result.exe).toBe('endstate');
      expect(result.args).toEqual(['verify', '--json', '--profile', 'test.jsonc']);
      expect(result.displayCommand).toBe('endstate verify --json --profile test.jsonc');
    });
  });

  describe('displayCommand accuracy', () => {
    it('script mode displayCommand never shows bare endstate', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\endstate.ps1',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      // Must NOT start with 'endstate ' - that would indicate fallback
      expect(result.displayCommand).not.toMatch(/^endstate\s/);
      expect(result.displayCommand).toMatch(/^pwsh\s/);
    });

    it('bundled mode displayCommand always shows [bundled] prefix', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.displayCommand).toMatch(/^\[bundled\]/);
    });
  });
});

describe('runEndstateOnce', () => {
  const baseSettings: AppSettings = {
    engineMode: 'bundled',
    engineScriptPath: '',
    customProfilesDirectory: '',
    selectedProfileName: null,
    dryRunEnabled: false,
    showDetails: false,
  };

  const validEnvelope = {
    schemaVersion: '1.0',
    cliVersion: '1.0.0',
    command: 'capabilities',
    runId: 'test-run',
    timestampUtc: '2024-01-01T00:00:00Z',
    success: true,
    data: { commands: ['capabilities'] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEngineAvailable.mockReturnValue(true);
    mockValidateScriptPath.mockResolvedValue(null);
  });

  describe('web mode (engine unavailable)', () => {
    beforeEach(() => {
      mockIsEngineAvailable.mockReturnValue(false);
    });

    it('returns engine_unavailable_web error when no mock engine', async () => {
      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('engine_unavailable_web');
        expect(result.error.message).toContain('web mode');
      }
    });

    it('uses mock engine runEndstateOnce if available', async () => {
      const mockResult = { success: true, envelope: validEnvelope, stdout: '{}', stderr: '', exitCode: 0 };
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateOnce: vi.fn().mockReturnValue(mockResult),
      };

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(true);
      expect((window as any).__ENDSTATE_MOCK_ENGINE__.runEndstateOnce).toHaveBeenCalledWith(
        baseSettings, 'capabilities', []
      );

      delete (window as any).__ENDSTATE_MOCK_ENGINE__;
    });

    it('returns mock capabilities for capabilities command when mock engine has no runEndstateOnce', async () => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {};

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.envelope as any).command).toBe('capabilities');
        expect((result.envelope as any).success).toBe(true);
      }

      delete (window as any).__ENDSTATE_MOCK_ENGINE__;
    });

    it('returns engine_unavailable_web for non-capabilities command when mock has no runEndstateOnce', async () => {
      (window as any).__ENDSTATE_MOCK_ENGINE__ = {};

      const result = await runEndstateOnce(baseSettings, 'verify');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('engine_unavailable_web');
      }

      delete (window as any).__ENDSTATE_MOCK_ENGINE__;
    });
  });

  describe('script mode validation', () => {
    it('returns command_not_found when script path validation fails', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\bad\\path.ps1',
      };
      mockValidateScriptPath.mockResolvedValue('Engine script not found at: C:\\bad\\path.ps1');

      const result = await runEndstateOnce(settings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
        expect(result.error.message).toContain('Engine script not found');
        expect(result.error.details).toContain('C:\\bad\\path.ps1');
      }
    });

    it('proceeds with execution when script path is valid', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\valid\\endstate.ps1',
      };
      mockValidateScriptPath.mockResolvedValue(null);
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(settings, 'capabilities');

      expect(result.success).toBe(true);
    });

    it('does not validate script path for bundled mode', async () => {
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      await runEndstateOnce(baseSettings, 'capabilities');

      expect(mockValidateScriptPath).not.toHaveBeenCalled();
    });
  });

  describe('successful execution', () => {
    it('returns parsed envelope on success', async () => {
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.envelope).toEqual(validEnvelope);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe('');
      }
    });

    it('finds JSON after log lines in stdout', async () => {
      const stdoutWithLogs = `[INFO] Starting engine...
[DEBUG] Loading config...
${JSON.stringify(validEnvelope)}`;

      mockInvoke.mockResolvedValue({
        stdout: stdoutWithLogs,
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.envelope).toEqual(validEnvelope);
      }
    });

    it('passes command args correctly to invoke', async () => {
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      await runEndstateOnce(baseSettings, 'verify', ['--profile', 'test.jsonc']);

      expect(mockInvoke).toHaveBeenCalledWith('endstate_exec', {
        exe: '__bundled__',
        args: ['verify', '--json', '--profile', 'test.jsonc'],
      });
    });
  });

  describe('command not found errors', () => {
    it('detects "not recognized" in stderr', async () => {
      mockInvoke.mockResolvedValue({
        stdout: '',
        stderr: "'endstate' is not recognized as an internal or external command",
        exitCode: 1,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
      }
    });

    it('detects "not found" in stderr', async () => {
      mockInvoke.mockResolvedValue({
        stdout: '',
        stderr: 'endstate: command not found',
        exitCode: 127,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
        expect(result.error.exitCode).toBe(127);
      }
    });

    it('detects "CommandNotFoundException" in stderr', async () => {
      mockInvoke.mockResolvedValue({
        stdout: '',
        stderr: 'CommandNotFoundException: The term "endstate" is not recognized',
        exitCode: 1,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
      }
    });

    it('provides helpful message for path mode', async () => {
      const settings: AppSettings = { ...baseSettings, engineMode: 'path' };
      mockInvoke.mockResolvedValue({
        stdout: '',
        stderr: 'endstate: command not found',
        exitCode: 127,
      });

      const result = await runEndstateOnce(settings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
        expect(result.error.message).toContain('installed and in PATH');
      }
    });
  });

  describe('non-zero exit code (not command-not-found)', () => {
    it('returns command_failed for generic non-zero exit', async () => {
      mockInvoke.mockResolvedValue({
        stdout: 'some output',
        stderr: 'Something went wrong',
        exitCode: 2,
      });

      const result = await runEndstateOnce(baseSettings, 'verify');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_failed');
        expect(result.error.message).toContain('exit code 2');
        expect(result.error.exitCode).toBe(2);
        expect(result.error.stderr).toBe('Something went wrong');
        expect(result.stdout).toBe('some output');
      }
    });
  });

  describe('empty or no-JSON stdout', () => {
    it('returns command_failed for empty stdout', async () => {
      mockInvoke.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_failed');
        expect(result.error.message).toContain('no output');
      }
    });

    it('returns command_failed for whitespace-only stdout', async () => {
      mockInvoke.mockResolvedValue({
        stdout: '   \n  ',
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_failed');
        expect(result.error.message).toContain('no output');
      }
    });

    it('returns command_failed when no JSON line found in stdout', async () => {
      mockInvoke.mockResolvedValue({
        stdout: 'plain text output\nno json here\njust logs',
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_failed');
        expect(result.error.message).toContain('No JSON found');
      }
    });
  });

  describe('JSON parse failure', () => {
    it('returns command_failed when JSON is malformed', async () => {
      mockInvoke.mockResolvedValue({
        stdout: '{ broken json',
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_failed');
        expect(result.error.message).toContain('Failed to parse JSON');
      }
    });
  });

  describe('domain failures (envelope.success === false)', () => {
    it('returns verify_failed for VERIFY_FAILED error code', async () => {
      const failEnvelope = {
        ...validEnvelope,
        success: false,
        error: { code: 'VERIFY_FAILED', message: '3 apps missing' },
        data: { items: [] },
      };
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(failEnvelope),
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'verify');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('verify_failed');
        expect(result.error.message).toBe('3 apps missing');
        // Envelope should still be available for domain failures
        expect(result.envelope).toBeDefined();
      }
    });

    it('returns command_failed for other envelope error codes', async () => {
      const failEnvelope = {
        ...validEnvelope,
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'Something broke' },
      };
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(failEnvelope),
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'apply');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_failed');
        expect(result.error.message).toBe('Something broke');
        expect(result.envelope).toBeDefined();
      }
    });

    it('uses fallback message when envelope error has no message', async () => {
      const failEnvelope = {
        ...validEnvelope,
        success: false,
        error: { code: 'UNKNOWN' },
      };
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(failEnvelope),
        stderr: '',
        exitCode: 0,
      });

      const result = await runEndstateOnce(baseSettings, 'verify');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Command returned failure');
      }
    });
  });

  describe('invoke errors (Tauri-level failures)', () => {
    it('returns command_not_found when invoke throws "not found" error', async () => {
      mockInvoke.mockRejectedValue(new Error('program not found'));

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
      }
    });

    it('returns command_not_found when invoke throws "not recognized" error', async () => {
      mockInvoke.mockRejectedValue(new Error('endstate is not recognized'));

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('command_not_found');
      }
    });

    it('returns invoke_failed for generic invoke errors', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC channel closed'));

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('invoke_failed');
        expect(result.error.message).toContain('IPC channel closed');
      }
    });

    it('handles non-Error thrown values', async () => {
      mockInvoke.mockRejectedValue('string error');

      const result = await runEndstateOnce(baseSettings, 'capabilities');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe('invoke_failed');
        expect(result.error.message).toContain('string error');
      }
    });
  });

  describe('engine modes in execution', () => {
    it('uses __bundled__ exe for bundled mode', async () => {
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      await runEndstateOnce(baseSettings, 'capabilities');

      expect(mockInvoke).toHaveBeenCalledWith('endstate_exec', expect.objectContaining({
        exe: '__bundled__',
      }));
    });

    it('uses endstate exe for path mode', async () => {
      const settings: AppSettings = { ...baseSettings, engineMode: 'path' };
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      await runEndstateOnce(settings, 'capabilities');

      expect(mockInvoke).toHaveBeenCalledWith('endstate_exec', expect.objectContaining({
        exe: 'endstate',
      }));
    });

    it('uses pwsh exe for script mode', async () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\endstate.ps1',
      };
      mockInvoke.mockResolvedValue({
        stdout: JSON.stringify(validEnvelope),
        stderr: '',
        exitCode: 0,
      });

      await runEndstateOnce(settings, 'capabilities');

      expect(mockInvoke).toHaveBeenCalledWith('endstate_exec', expect.objectContaining({
        exe: 'pwsh',
      }));
    });
  });
});

describe('getErrorMessage', () => {
  it('returns web mode message for engine_unavailable_web', () => {
    const error: EngineError = {
      kind: 'engine_unavailable_web',
      message: 'Engine not available in web mode.',
    };
    const msg = getErrorMessage(error);
    expect(msg).toContain('web mode');
    expect(msg).toContain('mock mode');
  });

  it('returns install guidance for command_not_found', () => {
    const error: EngineError = {
      kind: 'command_not_found',
      message: 'endstate not found',
    };
    const msg = getErrorMessage(error);
    expect(msg).toContain('not found');
    expect(msg).toContain('Settings');
  });

  it('returns the error message for command_failed', () => {
    const error: EngineError = {
      kind: 'command_failed',
      message: 'Command failed with exit code 2',
    };
    expect(getErrorMessage(error)).toBe('Command failed with exit code 2');
  });

  it('wraps message for invoke_failed', () => {
    const error: EngineError = {
      kind: 'invoke_failed',
      message: 'IPC timeout',
    };
    const msg = getErrorMessage(error);
    expect(msg).toContain('Failed to run command');
    expect(msg).toContain('IPC timeout');
  });

  it('returns raw message for verify_failed', () => {
    const error: EngineError = {
      kind: 'verify_failed',
      message: '3 apps missing from system',
    };
    expect(getErrorMessage(error)).toBe('3 apps missing from system');
  });
});
