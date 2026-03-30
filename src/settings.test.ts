import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSettings, saveSettings, AppSettings } from './settings';

// Unit tests run in happy-dom (not Tauri), so storage uses "web" namespace
const NAMESPACED_KEY = 'web:endstate-gui-settings';
const LEGACY_KEY = 'endstate-gui-settings';

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('returns default settings when localStorage is empty', () => {
      const settings = loadSettings();

      expect(settings.engineMode).toBe('bundled');
      expect(settings.customProfilesDirectory).toBe('');
      expect(settings.selectedProfileName).toBeNull();
      expect(settings.dryRunEnabled).toBe(true);
    });

    it('loads settings from localStorage when present (namespaced)', () => {
      const stored: AppSettings = {
        engineMode: 'path',
        customProfilesDirectory: '/manifests',
        selectedProfileName: 'TestProfile',
        dryRunEnabled: false,
        showDetails: false,
      };
      localStorage.setItem(NAMESPACED_KEY, JSON.stringify(stored));

      const settings = loadSettings();

      expect(settings).toEqual(stored);
    });

    it('migrates legacy un-namespaced settings to namespaced key', () => {
      const stored: AppSettings = {
        engineMode: 'path',
        customProfilesDirectory: '/legacy',
        selectedProfileName: null,
        dryRunEnabled: false,
        showDetails: false,
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

      expect(settings.engineMode).toBe('bundled');
      expect(settings.dryRunEnabled).toBe(true);
    });

    it('migrates stored script mode to bundled', () => {
      const stored = {
        engineMode: 'script',
        engineScriptPath: '/old/path.ps1',
        customProfilesDirectory: '',
        selectedProfileName: null,
        dryRunEnabled: true,
        showDetails: false,
      };
      localStorage.setItem(NAMESPACED_KEY, JSON.stringify(stored));

      const settings = loadSettings();

      expect(settings.engineMode).toBe('bundled');
      expect((settings as any).engineScriptPath).toBeUndefined();
    });
  });

  describe('saveSettings', () => {
    it('persists settings to localStorage with namespace', () => {
      const settings: AppSettings = {
        engineMode: 'path',
        customProfilesDirectory: '/test/manifests',
        selectedProfileName: 'Profile1',
        dryRunEnabled: false,
        showDetails: false,
      };

      saveSettings(settings);

      const stored = localStorage.getItem(NAMESPACED_KEY);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(settings);
    });

    it('overwrites existing settings', () => {
      const initial: AppSettings = {
        engineMode: 'bundled',
        customProfilesDirectory: '/old',
        selectedProfileName: 'Old',
        dryRunEnabled: true,
        showDetails: false,
      };
      saveSettings(initial);

      const updated: AppSettings = {
        engineMode: 'path',
        customProfilesDirectory: '/new',
        selectedProfileName: 'New',
        dryRunEnabled: false,
        showDetails: false,
      };
      saveSettings(updated);

      const stored = localStorage.getItem(NAMESPACED_KEY);
      expect(JSON.parse(stored!)).toEqual(updated);
    });
  });
});
