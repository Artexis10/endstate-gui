import { describe, it, expect } from 'vitest';
import { buildEngineCommand } from './engine-exec';
import { AppSettings } from '../settings';

describe('buildEngineCommand', () => {
  const baseSettings: AppSettings = {
    engineMode: 'bundled',
    engineScriptPath: '',
    customProfilesDirectory: '',
    lastSelectedProfile: '',
    lastSelectedProfilePath: '',
    dryRunEnabled: true,
    showDetails: false,
  };

  describe('script mode', () => {
    it('returns pwsh with -File flag for script mode', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\Users\\test\\endstate\\bin\\endstate.ps1',
      };

      const result = buildEngineCommand(settings, ['capabilities', '--json']);

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

    it('includes all command args after script path', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\endstate.ps1',
      };

      const result = buildEngineCommand(settings, ['verify', '--json', '--profile', 'test.jsonc']);

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

    it('displayCommand shows quoted script path', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\path with spaces\\endstate.ps1',
      };

      const result = buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.displayCommand).toContain('"C:\\path with spaces\\endstate.ps1"');
    });
  });

  describe('bundled mode', () => {
    it('returns endstate exe for bundled mode', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.exe).toBe('endstate');
      expect(result.args).toEqual(['capabilities', '--json']);
      expect(result.displayCommand).toBe('endstate capabilities --json');
    });
  });

  describe('path mode', () => {
    it('returns endstate exe for path mode', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'path',
      };

      const result = buildEngineCommand(settings, ['verify', '--json', '--profile', 'test.jsonc']);

      expect(result.exe).toBe('endstate');
      expect(result.args).toEqual(['verify', '--json', '--profile', 'test.jsonc']);
      expect(result.displayCommand).toBe('endstate verify --json --profile test.jsonc');
    });
  });

  describe('displayCommand accuracy', () => {
    it('script mode displayCommand never shows bare endstate', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'script',
        engineScriptPath: 'C:\\test\\endstate.ps1',
      };

      const result = buildEngineCommand(settings, ['capabilities', '--json']);

      // Must NOT start with 'endstate ' - that would indicate fallback
      expect(result.displayCommand).not.toMatch(/^endstate\s/);
      expect(result.displayCommand).toMatch(/^pwsh\s/);
    });

    it('bundled mode displayCommand shows endstate', () => {
      const settings: AppSettings = {
        ...baseSettings,
        engineMode: 'bundled',
      };

      const result = buildEngineCommand(settings, ['capabilities', '--json']);

      expect(result.displayCommand).toMatch(/^endstate\s/);
    });
  });
});
