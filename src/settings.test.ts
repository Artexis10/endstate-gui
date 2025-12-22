import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSettings, saveSettings, AppSettings } from './settings';

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('returns default settings when localStorage is empty', () => {
      const settings = loadSettings();
      
      expect(settings.engineMode).toBe('script');
      expect(settings.engineScriptPath).toBe('C:\\Users\\win-laptop\\Desktop\\projects\\autosuite\\autosuite.ps1');
      expect(settings.customProfilesDirectory).toBe('');
      expect(settings.lastSelectedProfile).toBe('');
      expect(settings.dryRunEnabled).toBe(true);
    });

    it('loads settings from localStorage when present', () => {
      const stored: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/custom/path.ps1',
        customProfilesDirectory: '/manifests',
        lastSelectedProfile: 'TestProfile',
        dryRunEnabled: false,
      };
      localStorage.setItem('autosuite-gui-settings', JSON.stringify(stored));

      const settings = loadSettings();
      
      expect(settings).toEqual(stored);
    });

    it('merges partial settings with defaults', () => {
      const partial = {
        engineMode: 'path' as const,
        customProfilesDirectory: '/custom',
      };
      localStorage.setItem('autosuite-gui-settings', JSON.stringify(partial));

      const settings = loadSettings();
      
      expect(settings.engineMode).toBe('path');
      expect(settings.customProfilesDirectory).toBe('/custom');
      expect(settings.dryRunEnabled).toBe(true);
    });

    it('returns defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem('autosuite-gui-settings', 'invalid-json');
      
      const settings = loadSettings();
      
      expect(settings.engineMode).toBe('script');
      expect(settings.dryRunEnabled).toBe(true);
    });
  });

  describe('saveSettings', () => {
    it('persists settings to localStorage', () => {
      const settings: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/test/path.ps1',
        customProfilesDirectory: '/test/manifests',
        lastSelectedProfile: 'Profile1',
        dryRunEnabled: false,
      };

      saveSettings(settings);

      const stored = localStorage.getItem('autosuite-gui-settings');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(settings);
    });

    it('overwrites existing settings', () => {
      const initial: AppSettings = {
        engineMode: 'script',
        engineScriptPath: '/old/path.ps1',
        customProfilesDirectory: '/old',
        lastSelectedProfile: 'Old',
        dryRunEnabled: true,
      };
      saveSettings(initial);

      const updated: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/new/path.ps1',
        customProfilesDirectory: '/new',
        lastSelectedProfile: 'New',
        dryRunEnabled: false,
      };
      saveSettings(updated);

      const stored = localStorage.getItem('autosuite-gui-settings');
      expect(JSON.parse(stored!)).toEqual(updated);
    });
  });
});
