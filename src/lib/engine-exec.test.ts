import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEngineCommand } from './engine-exec';
import { AppSettings } from '../settings';

// Mock the tauri-bridge invoke function
vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
  isEngineAvailable: vi.fn(() => true),
}));

import { invoke } from './tauri-bridge';
const mockInvoke = vi.mocked(invoke);

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
    it('uses sidecar binary path when available', async () => {
      const bundledPath = 'C:\\Program Files\\endstate-gui\\endstate.exe';
      mockInvoke.mockResolvedValue(bundledPath);

      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(mockInvoke).toHaveBeenCalledWith('get_bundled_engine_path');
      expect(result.exe).toBe(bundledPath);
      expect(result.args).toEqual([
        'capabilities',
        '--json',
      ]);
      expect(result.displayCommand).toBe('[bundled] capabilities --json');
    });

    it('falls back to endstate PATH when bundled path is null (dev mode)', async () => {
      mockInvoke.mockResolvedValue(null);

      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(mockInvoke).toHaveBeenCalledWith('get_bundled_engine_path');
      expect(result.exe).toBe('endstate');
      expect(result.args).toEqual(['capabilities', '--json']);
      expect(result.displayCommand).toBe('endstate capabilities --json');
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

    it('bundled mode displayCommand shows [bundled] when path available', async () => {
      mockInvoke.mockResolvedValue('C:\\path\\to\\endstate.ps1');

      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.displayCommand).toMatch(/^\[bundled\]/);
    });

    it('bundled mode displayCommand shows endstate when no bundled path (dev fallback)', async () => {
      mockInvoke.mockResolvedValue(null);

      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = await buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.displayCommand).toMatch(/^endstate\s/);
    });
  });
});
