import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSettingsWithProfileMigration, clearSelectedProfile } from './settings';
import * as storage from './lib/storage';
import * as migration from './lib/profile-selection-migration';

vi.mock('./lib/storage');
vi.mock('./lib/profile-selection-migration');
vi.mock('./lib/engine-path');

describe('settings profile selection migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSettingsWithProfileMigration', () => {
    it('should return settings unchanged if selectedProfileName already exists', async () => {
      // Simulate stored settings with selectedProfileName already set
      const mockSettings = {
        engineMode: 'bundled',
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: 'myprofile',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBe('myprofile');
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should migrate from legacy lastSelectedProfilePath when selectedProfileName is null', async () => {
      // Simulate legacy stored settings with path but no selectedProfileName
      const legacySettings = {
        engineMode: 'bundled',
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: 'C:\\profiles\\myprofile.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(legacySettings));
      vi.mocked(migration.migrateProfileSelection).mockResolvedValue('myprofile');

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(migration.migrateProfileSelection).toHaveBeenCalledWith(
        'C:\\profiles\\myprofile.jsonc',
        'C:\\profiles'
      );
      expect(result.selectedProfileName).toBe('myprofile');
      expect(storage.setItem).toHaveBeenCalled();
      // Verify legacy fields are NOT in the saved settings
      const savedCall = vi.mocked(storage.setItem).mock.calls[0];
      const savedSettings = JSON.parse(savedCall[1]);
      expect(savedSettings).not.toHaveProperty('lastSelectedProfile');
      expect(savedSettings).not.toHaveProperty('lastSelectedProfilePath');
    });

    it('should clear selection when migration fails', async () => {
      const legacySettings = {
        engineMode: 'bundled',
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: 'C:\\profiles\\nonexistent.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(legacySettings));
      vi.mocked(migration.migrateProfileSelection).mockResolvedValue(null);

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBeNull();
      expect(storage.setItem).toHaveBeenCalled();
      // Verify legacy fields are NOT in the result
      expect(result).not.toHaveProperty('lastSelectedProfile');
      expect(result).not.toHaveProperty('lastSelectedProfilePath');
    });

    it('should migrate from legacy lastSelectedProfile when no path exists', async () => {
      const legacySettings = {
        engineMode: 'bundled',
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: 'myprofile',
        lastSelectedProfilePath: '',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(legacySettings));

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBe('myprofile');
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('should handle draft_ paths by clearing selection', async () => {
      const legacySettings = {
        engineMode: 'bundled',
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: 'C:\\cache\\draft_2024-01-01.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(legacySettings));
      vi.mocked(migration.migrateProfileSelection).mockResolvedValue(null);

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBeNull();
      // Verify legacy fields are NOT in the result
      expect(result).not.toHaveProperty('lastSelectedProfile');
      expect(result).not.toHaveProperty('lastSelectedProfilePath');
    });
  });

  describe('clearSelectedProfile', () => {
    it('should clear selectedProfileName only', () => {
      const mockSettings = {
        engineMode: 'bundled',
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: 'myprofile',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));

      clearSelectedProfile();

      expect(storage.setItem).toHaveBeenCalledWith(
        'endstate-gui-settings',
        expect.stringContaining('"selectedProfileName":null')
      );
      // Verify legacy fields are NOT written
      const savedCall = vi.mocked(storage.setItem).mock.calls[0];
      const savedSettings = JSON.parse(savedCall[1]);
      expect(savedSettings).not.toHaveProperty('lastSelectedProfile');
      expect(savedSettings).not.toHaveProperty('lastSelectedProfilePath');
    });
  });
});
