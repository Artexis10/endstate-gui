import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSettings, saveSettings, AppSettings } from './settings';

// Unit tests run in happy-dom (not Tauri), so storage uses "web" namespace
const NAMESPACED_KEY = 'web:autosuite-gui-settings';
const LEGACY_KEY = 'autosuite-gui-settings';

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

    it('loads settings from localStorage when present (namespaced)', () => {
      const stored: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/custom/path.ps1',
        customProfilesDirectory: '/manifests',
        lastSelectedProfile: 'TestProfile',
        lastSelectedProfilePath: '/manifests/TestProfile.jsonc',
        dryRunEnabled: false,
      };
      localStorage.setItem(NAMESPACED_KEY, JSON.stringify(stored));

      const settings = loadSettings();
      
      expect(settings).toEqual(stored);
    });

    it('migrates legacy un-namespaced settings to namespaced key', () => {
      const stored: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/legacy/path.ps1',
        customProfilesDirectory: '/legacy',
        lastSelectedProfile: 'Legacy',
        lastSelectedProfilePath: '/legacy/Legacy.jsonc',
        dryRunEnabled: false,
      };
      localStorage.setItem(LEGACY_KEY, JSON.stringify(stored));

      const settings = loadSettings();
      
      expect(settings).toEqual(stored);
      // Legacy key should be removed after migration
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
      // Namespaced key should now exist
      expect(localStorage.getItem(NAMESPACED_KEY)).toBeTruthy();
    });

    it('merges partial settings with defaults', () => {
      const partial = {
        engineMode: 'path' as const,
        customProfilesDirectory: '/custom',
      };
      localStorage.setItem(NAMESPACED_KEY, JSON.stringify(partial));

      const settings = loadSettings();
      
      expect(settings.engineMode).toBe('path');
      expect(settings.customProfilesDirectory).toBe('/custom');
      expect(settings.dryRunEnabled).toBe(true);
    });

    it('returns defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(NAMESPACED_KEY, 'invalid-json');
      
      const settings = loadSettings();
      
      expect(settings.engineMode).toBe('script');
      expect(settings.dryRunEnabled).toBe(true);
    });
  });

  describe('saveSettings', () => {
    it('persists settings to localStorage with namespace', () => {
      const settings: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/test/path.ps1',
        customProfilesDirectory: '/test/manifests',
        lastSelectedProfile: 'Profile1',
        lastSelectedProfilePath: '/test/manifests/Profile1.jsonc',
        dryRunEnabled: false,
      };

      saveSettings(settings);

      const stored = localStorage.getItem(NAMESPACED_KEY);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(settings);
    });

    it('overwrites existing settings', () => {
      const initial: AppSettings = {
        engineMode: 'script',
        engineScriptPath: '/old/path.ps1',
        customProfilesDirectory: '/old',
        lastSelectedProfile: 'Old',
        lastSelectedProfilePath: '/old/Old.jsonc',
        dryRunEnabled: true,
      };
      saveSettings(initial);

      const updated: AppSettings = {
        engineMode: 'path',
        engineScriptPath: '/new/path.ps1',
        customProfilesDirectory: '/new',
        lastSelectedProfile: 'New',
        lastSelectedProfilePath: '/new/New.jsonc',
        dryRunEnabled: false,
      };
      saveSettings(updated);

      const stored = localStorage.getItem(NAMESPACED_KEY);
      expect(JSON.parse(stored!)).toEqual(updated);
    });
  });
});
