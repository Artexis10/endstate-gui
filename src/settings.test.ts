import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSettings,
  saveSettings,
  loadSettingsWithProfileMigration,
  AppSettings,
} from './settings';
import { setItem } from './lib/storage';

// Unit tests run in happy-dom (not Tauri), so storage uses "web" namespace
const NAMESPACED_KEY = 'web:endstate-gui-settings';
const LEGACY_KEY = 'endstate-gui-settings';

// New auto-backup + continuous-protection fields, defaulted off. Reused so the
// existing round-trip assertions keep matching what loadSettings() now returns.
const AUTO_BACKUP_DEFAULTS = {
  autoBackupEnabled: false,
  autoBackupPromptSeen: false,
  profileBackupIds: {} as Record<string, string>,
  scheduleEnabled: false,
  scheduleTime: '09:00',
  scheduleAutoPush: false,
  scheduleManifestPath: null as string | null,
  // loadSettings stamps this on any stored settings that predate the dry-run
  // default correction, so round-trip assertions must expect it.
  dryRunDefaultCorrected: true as boolean | undefined,
};

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
      expect(settings.dryRunEnabled).toBe(false);
    });

    // dryRunEnabled used to default to true, and saveSettings persists the whole
    // object — so existing installs have it stored whether or not the user ever
    // chose it. Changing the default alone would leave every existing user
    // running --dry-run: installing nothing while the results screen reports
    // "Setup complete". These cases pin the correction's semantics.
    describe('dry-run default correction', () => {
      it('clears a stored dry-run flag that predates the correction', () => {
        localStorage.setItem(
          NAMESPACED_KEY,
          JSON.stringify({ engineMode: 'bundled', dryRunEnabled: true })
        );

        const settings = loadSettings();

        expect(settings.dryRunEnabled).toBe(false);
        expect(settings.dryRunDefaultCorrected).toBe(true);
      });

      it('does not re-clear dry run once the correction has run', () => {
        localStorage.setItem(
          NAMESPACED_KEY,
          JSON.stringify({
            engineMode: 'bundled',
            dryRunEnabled: true,
            dryRunDefaultCorrected: true,
          })
        );

        const settings = loadSettings();

        // The user turned dry run back on after the correction ran; that is a
        // real preference and must survive every subsequent load.
        expect(settings.dryRunEnabled).toBe(true);
      });

      it('persists the correction marker so it runs at most once', () => {
        localStorage.setItem(
          NAMESPACED_KEY,
          JSON.stringify({ engineMode: 'bundled', dryRunEnabled: true })
        );

        saveSettings(loadSettings());
        const reloaded = loadSettings();

        expect(reloaded.dryRunDefaultCorrected).toBe(true);
        expect(reloaded.dryRunEnabled).toBe(false);
      });
    });

    it('loads settings from localStorage when present (namespaced)', () => {
      const stored: AppSettings = {
        engineMode: 'path',
        customProfilesDirectory: '/manifests',
        selectedProfileName: 'TestProfile',
        dryRunEnabled: false,
        showDetails: false,
        ...AUTO_BACKUP_DEFAULTS,
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
        ...AUTO_BACKUP_DEFAULTS,
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
      expect(settings.dryRunEnabled).toBe(false);
    });

    it('returns defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(NAMESPACED_KEY, 'invalid-json');

      const settings = loadSettings();

      expect(settings.engineMode).toBe('bundled');
      expect(settings.dryRunEnabled).toBe(false);
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
        ...AUTO_BACKUP_DEFAULTS,
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
        ...AUTO_BACKUP_DEFAULTS,
      };
      saveSettings(initial);

      const updated: AppSettings = {
        engineMode: 'path',
        customProfilesDirectory: '/new',
        selectedProfileName: 'New',
        dryRunEnabled: false,
        showDetails: false,
        ...AUTO_BACKUP_DEFAULTS,
      };
      saveSettings(updated);

      const stored = localStorage.getItem(NAMESPACED_KEY);
      expect(JSON.parse(stored!)).toEqual(updated);
    });
  });

  describe('auto-backup fields', () => {
    const FULL: AppSettings = {
      engineMode: 'bundled',
      customProfilesDirectory: '',
      selectedProfileName: 'my-profile',
      dryRunEnabled: true,
      showDetails: false,
      autoBackupEnabled: true,
      autoBackupPromptSeen: true,
      profileBackupIds: { 'my-profile': 'b-123' },
      scheduleEnabled: false,
      scheduleTime: '09:00',
      scheduleAutoPush: false,
      scheduleManifestPath: null,
    };

    it('round-trips the new auto-backup fields through save/load', () => {
      saveSettings(FULL);
      const loaded = loadSettings();
      expect(loaded.autoBackupEnabled).toBe(true);
      expect(loaded.autoBackupPromptSeen).toBe(true);
      expect(loaded.profileBackupIds).toEqual({ 'my-profile': 'b-123' });
    });

    it('defaults the new fields for settings stored before they existed', () => {
      // A settings blob persisted by an older build — no auto-backup keys.
      setItem(
        'endstate-gui-settings',
        JSON.stringify({
          engineMode: 'bundled',
          customProfilesDirectory: '',
          selectedProfileName: 'legacy',
          dryRunEnabled: true,
          showDetails: false,
        }),
      );
      const loaded = loadSettings();
      expect(loaded.autoBackupEnabled).toBe(false);
      expect(loaded.autoBackupPromptSeen).toBe(false);
      expect(loaded.profileBackupIds).toEqual({});
      expect(loaded.selectedProfileName).toBe('legacy');
    });

    it('preserves the new fields through loadSettingsWithProfileMigration', async () => {
      saveSettings(FULL);
      const migrated = await loadSettingsWithProfileMigration('C:\\profiles');
      expect(migrated.autoBackupEnabled).toBe(true);
      expect(migrated.autoBackupPromptSeen).toBe(true);
      expect(migrated.profileBackupIds).toEqual({ 'my-profile': 'b-123' });
    });

    it('carries the new fields through the legacy name-based migration path', async () => {
      // Legacy selection (no selectedProfileName, has lastSelectedProfile) + opted-in.
      setItem(
        'endstate-gui-settings',
        JSON.stringify({
          engineMode: 'bundled',
          customProfilesDirectory: '',
          dryRunEnabled: true,
          showDetails: false,
          autoBackupEnabled: true,
          autoBackupPromptSeen: true,
          profileBackupIds: { foo: 'b-9' },
          lastSelectedProfile: 'foo',
        }),
      );
      const migrated = await loadSettingsWithProfileMigration('C:\\profiles');
      expect(migrated.selectedProfileName).toBe('foo');
      expect(migrated.autoBackupEnabled).toBe(true);
      expect(migrated.profileBackupIds).toEqual({ foo: 'b-9' });
    });
  });

  describe('continuous-protection fields', () => {
    it('defaults schedule fields off with 09:00 and no manifest', () => {
      const loaded = loadSettings();
      expect(loaded.scheduleEnabled).toBe(false);
      expect(loaded.scheduleTime).toBe('09:00');
      expect(loaded.scheduleAutoPush).toBe(false);
      expect(loaded.scheduleManifestPath).toBeNull();
    });

    it('round-trips the schedule fields through save/load', () => {
      saveSettings({
        ...loadSettings(),
        scheduleEnabled: true,
        scheduleTime: '21:30',
        scheduleAutoPush: true,
        scheduleManifestPath: 'C:\\snapshots\\this-computer.zip',
      });
      const loaded = loadSettings();
      expect(loaded.scheduleEnabled).toBe(true);
      expect(loaded.scheduleTime).toBe('21:30');
      expect(loaded.scheduleAutoPush).toBe(true);
      expect(loaded.scheduleManifestPath).toBe('C:\\snapshots\\this-computer.zip');
    });

    it('defaults schedule fields for settings stored before they existed', () => {
      // A settings blob persisted by an older build — no schedule keys.
      setItem(
        'endstate-gui-settings',
        JSON.stringify({
          engineMode: 'bundled',
          customProfilesDirectory: '',
          selectedProfileName: 'legacy',
          dryRunEnabled: true,
          showDetails: false,
        }),
      );
      const loaded = loadSettings();
      expect(loaded.scheduleEnabled).toBe(false);
      expect(loaded.scheduleTime).toBe('09:00');
      expect(loaded.scheduleAutoPush).toBe(false);
      expect(loaded.scheduleManifestPath).toBeNull();
    });

    it('preserves the schedule fields through loadSettingsWithProfileMigration', async () => {
      saveSettings({
        ...loadSettings(),
        selectedProfileName: 'my-profile',
        scheduleEnabled: true,
        scheduleTime: '07:15',
        scheduleManifestPath: 'C:\\snapshots\\base.zip',
      });
      const migrated = await loadSettingsWithProfileMigration('C:\\profiles');
      expect(migrated.scheduleEnabled).toBe(true);
      expect(migrated.scheduleTime).toBe('07:15');
      expect(migrated.scheduleManifestPath).toBe('C:\\snapshots\\base.zip');
    });
  });
});
