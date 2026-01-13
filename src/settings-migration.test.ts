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
      const mockSettings = {
        engineMode: 'bundled' as const,
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: 'myprofile',
        lastSelectedProfile: 'myprofile',
        lastSelectedProfilePath: 'C:\\profiles\\myprofile.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBe('myprofile');
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should migrate from lastSelectedProfilePath when selectedProfileName is null', async () => {
      const mockSettings = {
        engineMode: 'bundled' as const,
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: 'C:\\profiles\\myprofile.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));
      vi.mocked(migration.migrateProfileSelection).mockResolvedValue('myprofile');

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(migration.migrateProfileSelection).toHaveBeenCalledWith(
        'C:\\profiles\\myprofile.jsonc',
        'C:\\profiles'
      );
      expect(result.selectedProfileName).toBe('myprofile');
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('should clear selection when migration fails', async () => {
      const mockSettings = {
        engineMode: 'bundled' as const,
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: 'C:\\profiles\\nonexistent.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));
      vi.mocked(migration.migrateProfileSelection).mockResolvedValue(null);

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBeNull();
      expect(result.lastSelectedProfile).toBe('');
      expect(result.lastSelectedProfilePath).toBe('');
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('should migrate from lastSelectedProfile when no path exists', async () => {
      const mockSettings = {
        engineMode: 'bundled' as const,
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: 'myprofile',
        lastSelectedProfilePath: '',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBe('myprofile');
      expect(storage.setItem).toHaveBeenCalled();
    });

    it('should handle draft_ paths by clearing selection', async () => {
      const mockSettings = {
        engineMode: 'bundled' as const,
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: null,
        lastSelectedProfile: '',
        lastSelectedProfilePath: 'C:\\cache\\draft_2024-01-01.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));
      vi.mocked(migration.migrateProfileSelection).mockResolvedValue(null);

      const result = await loadSettingsWithProfileMigration('C:\\profiles');

      expect(result.selectedProfileName).toBeNull();
      expect(result.lastSelectedProfile).toBe('');
      expect(result.lastSelectedProfilePath).toBe('');
    });
  });

  describe('clearSelectedProfile', () => {
    it('should clear all profile selection fields', () => {
      const mockSettings = {
        engineMode: 'bundled' as const,
        engineScriptPath: '',
        customProfilesDirectory: '',
        selectedProfileName: 'myprofile',
        lastSelectedProfile: 'myprofile',
        lastSelectedProfilePath: 'C:\\profiles\\myprofile.jsonc',
        dryRunEnabled: true,
        showDetails: false,
      };

      vi.mocked(storage.getItem).mockReturnValue(JSON.stringify(mockSettings));

      clearSelectedProfile();

      expect(storage.setItem).toHaveBeenCalledWith(
        'endstate-gui-settings',
        expect.stringContaining('"selectedProfileName":null')
      );
      expect(storage.setItem).toHaveBeenCalledWith(
        'endstate-gui-settings',
        expect.stringContaining('"lastSelectedProfile":""')
      );
      expect(storage.setItem).toHaveBeenCalledWith(
        'endstate-gui-settings',
        expect.stringContaining('"lastSelectedProfilePath":""')
      );
    });
  });
});
