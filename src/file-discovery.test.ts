import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverProfiles, discoverProfileDescriptors, getMetaPath, validateProfile } from './file-discovery';
import { invoke } from './lib/tauri-bridge';

vi.mock('./lib/tauri-bridge', () => ({
  invoke: vi.fn(),
}));

// Helper to create a valid validation result
const validResult = (name = 'test', appCount = 1) => ({
  valid: true,
  errors: [],
  summary: { name, version: 1, appCount },
});

// Helper to create an invalid validation result
const invalidResult = (code = 'MISSING_VERSION', message = 'No version field') => ({
  valid: false,
  errors: [{ code, message }],
});

describe('file-discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('discoverProfiles', () => {
    it('returns empty array when directory is empty string', async () => {
      const profiles = await discoverProfiles('');
      
      expect(profiles).toEqual([]);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns empty array when directory is whitespace', async () => {
      const profiles = await discoverProfiles('   ');
      
      expect(profiles).toEqual([]);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('maps file paths to profile objects for valid profiles', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return [
            'C:\\manifests\\Hugo-Laptop.jsonc',
            'C:\\manifests\\Test-Profile.json',
            'C:\\manifests\\Another.json5',
          ];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const profiles = await discoverProfiles('C:\\manifests');

      expect(profiles).toHaveLength(3);
      expect(profiles.map(p => p.name)).toEqual(['Hugo-Laptop', 'Test-Profile', 'Another']);
      expect(invoke).toHaveBeenCalledWith('list_manifest_files', { directory: 'C:\\manifests' });
    });

    it('handles Unix-style paths', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return [
            '/home/user/manifests/Profile1.jsonc',
            '/home/user/manifests/Profile2.json',
          ];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const profiles = await discoverProfiles('/home/user/manifests');

      expect(profiles).toHaveLength(2);
      expect(profiles.map(p => p.name)).toEqual(['Profile1', 'Profile2']);
    });

    it('strips .jsonc extension', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\test\\MyProfile.jsonc'];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const profiles = await discoverProfiles('C:\\test');

      expect(profiles[0].name).toBe('MyProfile');
    });

    it('strips .json extension', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\test\\MyProfile.json'];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const profiles = await discoverProfiles('C:\\test');

      expect(profiles[0].name).toBe('MyProfile');
    });

    it('strips .json5 extension', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\test\\MyProfile.json5'];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const profiles = await discoverProfiles('C:\\test');

      expect(profiles[0].name).toBe('MyProfile');
    });

    it('returns empty array on invoke error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Directory not found'));

      const profiles = await discoverProfiles('C:\\invalid');

      expect(profiles).toEqual([]);
    });

    it('handles empty result from invoke', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const profiles = await discoverProfiles('C:\\empty');

      expect(profiles).toEqual([]);
    });

    it('excludes .meta.json files from profile list', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return [
            'C:\\manifests\\setup_laptop.json',
            'C:\\manifests\\setup_laptop.meta.json',
            'C:\\manifests\\setup_desktop.jsonc',
            'C:\\manifests\\setup_desktop.meta.json',
          ];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const profiles = await discoverProfiles('C:\\manifests');

      // Should only include setup files, not .meta.json files
      expect(profiles).toHaveLength(2);
      expect(profiles.map(p => p.name)).toEqual(['setup_laptop', 'setup_desktop']);
      expect(profiles.map(p => p.path)).not.toContain('C:\\manifests\\setup_laptop.meta.json');
      expect(profiles.map(p => p.path)).not.toContain('C:\\manifests\\setup_desktop.meta.json');
    });
  });

  describe('discoverProfileDescriptors', () => {
    it('excludes .meta.json files and returns ProfileDescriptor objects', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return [
            'C:\\manifests\\setup_laptop.json',
            'C:\\manifests\\setup_laptop.meta.json',
            'C:\\manifests\\setup_desktop.jsonc',
          ];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      expect(descriptors).toHaveLength(2);
      expect(descriptors[0]).toMatchObject({
        id: 'setup_laptop',
        setupPath: 'C:\\manifests\\setup_laptop.json',
        metaPath: 'C:\\manifests\\setup_laptop.meta.json',
        label: 'setup_laptop',
      });
      expect(descriptors[1]).toMatchObject({
        id: 'setup_desktop',
        setupPath: 'C:\\manifests\\setup_desktop.jsonc',
        metaPath: 'C:\\manifests\\setup_desktop.meta.json',
        label: 'setup_desktop',
      });
    });

    it('loads displayName from metadata file when present', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\manifests\\setup_laptop.json'];
          if (cmd === 'validate_profile') return validResult('setup_laptop');
          if (cmd === 'check_file_exists') return true;
          if (cmd === 'read_text_file') return JSON.stringify({ displayName: 'My Laptop' });
          return null;
        });

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].displayName).toBe('My Laptop');
      expect(descriptors[0].label).toBe('My Laptop');
    });

    it('uses id as label when displayName is not present', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\manifests\\setup_laptop.json'];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].displayName).toBeUndefined();
      expect(descriptors[0].label).toBe('setup_laptop');
    });

    it('never includes .meta.json files as selectable profiles', async () => {
      // This is a critical test - .meta.json files must NEVER appear as profiles
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return [
            'C:\\manifests\\setup_work.json',
            'C:\\manifests\\setup_work.meta.json',
            'C:\\manifests\\config.meta.json',
            'C:\\manifests\\random.meta.json',
          ];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      // Only setup_work.json should be included
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].id).toBe('setup_work');
      
      // Verify no .meta.json paths in setupPath
      for (const d of descriptors) {
        expect(d.setupPath.toLowerCase()).not.toContain('.meta.json');
      }
    });

    it('excludes invalid manifests from profile list', async () => {
      // Contract-based validation: invalid manifests should not appear
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
          if (cmd === 'list_manifest_files') return [
            'C:\\manifests\\valid_profile.json',
            'C:\\manifests\\invalid_no_version.json',
            'C:\\manifests\\invalid_no_apps.json',
          ];
          if (cmd === 'validate_profile') {
            const path = (args as { path: string })?.path || '';
            if (path.includes('valid_profile')) return validResult();
            return invalidResult();
          }
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      // Only valid_profile.json should be included
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].id).toBe('valid_profile');
    });

    it('includes summary from validation result', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\manifests\\my_profile.jsonc'];
          if (cmd === 'validate_profile') return validResult('My Profile', 42);
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].summary).toEqual({
        name: 'My Profile',
        version: 1,
        appCount: 42,
      });
    });
  });

  describe('validateProfile', () => {
    it('returns validation result from engine', async () => {
      vi.mocked(invoke).mockResolvedValue(validResult('test-profile', 5));

      const result = await validateProfile('C:\\test\\profile.json');

      expect(result.valid).toBe(true);
      expect(result.summary?.name).toBe('test-profile');
      expect(result.summary?.appCount).toBe(5);
      expect(invoke).toHaveBeenCalledWith('validate_profile', { path: 'C:\\test\\profile.json' });
    });

    it('returns error result on invoke failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Engine not available'));

      const result = await validateProfile('C:\\test\\profile.json');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');
    });

    it('returns invalid result for missing version', async () => {
      vi.mocked(invoke).mockResolvedValue(invalidResult('MISSING_VERSION', 'No version field'));

      const result = await validateProfile('C:\\test\\no-version.json');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_VERSION');
    });
  });

  describe('getMetaPath', () => {
    it('converts .json to .meta.json', () => {
      expect(getMetaPath('C:\\profiles\\setup.json')).toBe('C:\\profiles\\setup.meta.json');
    });

    it('converts .jsonc to .meta.json', () => {
      expect(getMetaPath('C:\\profiles\\setup.jsonc')).toBe('C:\\profiles\\setup.meta.json');
    });

    it('converts .json5 to .meta.json', () => {
      expect(getMetaPath('C:\\profiles\\setup.json5')).toBe('C:\\profiles\\setup.meta.json');
    });

    it('handles Unix paths', () => {
      expect(getMetaPath('/home/user/profiles/setup.json')).toBe('/home/user/profiles/setup.meta.json');
    });
  });
});
