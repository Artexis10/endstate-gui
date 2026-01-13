import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateProfileSelection, resolveProfilePath } from './profile-selection-migration';
import * as tauriBridge from './tauri-bridge';

vi.mock('./tauri-bridge');

describe('profile-selection-migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('migrateProfileSelection', () => {
    it('should extract profile name when legacy path exists', async () => {
      const legacyPath = 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      vi.mocked(tauriBridge.invoke).mockResolvedValue(true);

      const result = await migrateProfileSelection(legacyPath, profilesDir);

      expect(result).toBe('myprofile');
      expect(tauriBridge.invoke).toHaveBeenCalledWith('check_file_exists', { path: legacyPath });
    });

    it('should resolve profile by name when legacy path does not exist', async () => {
      const legacyPath = 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      // First call: legacy path doesn't exist
      // Second call: resolved path exists
      vi.mocked(tauriBridge.invoke)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await migrateProfileSelection(legacyPath, profilesDir);

      expect(result).toBe('myprofile');
      expect(tauriBridge.invoke).toHaveBeenCalledWith('check_file_exists', { path: legacyPath });
      expect(tauriBridge.invoke).toHaveBeenCalledWith('check_file_exists', { 
        path: 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc' 
      });
    });

    it('should try different extensions when resolving by name', async () => {
      const legacyPath = 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      // First call: legacy path doesn't exist
      // Second call: .jsonc doesn't exist
      // Third call: .json exists
      vi.mocked(tauriBridge.invoke)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await migrateProfileSelection(legacyPath, profilesDir);

      expect(result).toBe('myprofile');
      expect(tauriBridge.invoke).toHaveBeenCalledWith('check_file_exists', { 
        path: 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.json' 
      });
    });

    it('should return null when profile cannot be resolved', async () => {
      const legacyPath = 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      // All paths don't exist
      vi.mocked(tauriBridge.invoke).mockResolvedValue(false);

      const result = await migrateProfileSelection(legacyPath, profilesDir);

      expect(result).toBeNull();
    });

    it('should return null for empty legacy path', async () => {
      const result = await migrateProfileSelection('', 'C:\\profiles');
      expect(result).toBeNull();
    });

    it('should return null for empty profiles directory', async () => {
      const result = await migrateProfileSelection('C:\\path\\to\\profile.jsonc', '');
      expect(result).toBeNull();
    });

    it('should handle draft_ paths correctly', async () => {
      const legacyPath = 'C:\\Users\\test\\AppData\\Local\\endstate-gui\\cache\\draft_2024-01-01.jsonc';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      // Draft path doesn't exist, and can't be resolved by name
      vi.mocked(tauriBridge.invoke).mockResolvedValue(false);

      const result = await migrateProfileSelection(legacyPath, profilesDir);

      expect(result).toBeNull();
    });
  });

  describe('resolveProfilePath', () => {
    it('should resolve profile with .jsonc extension', async () => {
      const profileName = 'myprofile';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      vi.mocked(tauriBridge.invoke).mockResolvedValue(true);

      const result = await resolveProfilePath(profileName, profilesDir);

      expect(result).toBe('C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc');
      expect(tauriBridge.invoke).toHaveBeenCalledWith('check_file_exists', { 
        path: 'C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.jsonc' 
      });
    });

    it('should try .json extension if .jsonc does not exist', async () => {
      const profileName = 'myprofile';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      vi.mocked(tauriBridge.invoke)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await resolveProfilePath(profileName, profilesDir);

      expect(result).toBe('C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.json');
    });

    it('should try .json5 extension if .jsonc and .json do not exist', async () => {
      const profileName = 'myprofile';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      vi.mocked(tauriBridge.invoke)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await resolveProfilePath(profileName, profilesDir);

      expect(result).toBe('C:\\Users\\test\\Documents\\Endstate\\Setups\\myprofile.json5');
    });

    it('should return null when no extension matches', async () => {
      const profileName = 'myprofile';
      const profilesDir = 'C:\\Users\\test\\Documents\\Endstate\\Setups';

      vi.mocked(tauriBridge.invoke).mockResolvedValue(false);

      const result = await resolveProfilePath(profileName, profilesDir);

      expect(result).toBeNull();
    });

    it('should return null for empty profile name', async () => {
      const result = await resolveProfilePath('', 'C:\\profiles');
      expect(result).toBeNull();
    });

    it('should return null for empty profiles directory', async () => {
      const result = await resolveProfilePath('myprofile', '');
      expect(result).toBeNull();
    });
  });
});
