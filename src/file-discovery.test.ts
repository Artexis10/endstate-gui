import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { describeSkippedProfiles, describeUnreadableProfilesFolder, discoverProfiles, discoverProfileDescriptors, getMetaPath, validateProfile } from './file-discovery';
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
      const { profiles } = await discoverProfiles('');
      
      expect(profiles).toEqual([]);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns empty array when directory is whitespace', async () => {
      const { profiles } = await discoverProfiles('   ');
      
      expect(profiles).toEqual([]);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('maps file paths to profile objects for valid profiles', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return [
            'C:\\manifests\\My-Laptop.jsonc',
            'C:\\manifests\\Test-Profile.json',
            'C:\\manifests\\Another.json5',
          ];
          if (cmd === 'validate_profile') return validResult();
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const { profiles } = await discoverProfiles('C:\\manifests');

      expect(profiles).toHaveLength(3);
      expect(profiles.map(p => p.name)).toEqual(['My-Laptop', 'Test-Profile', 'Another']);
      expect(invoke).toHaveBeenCalledWith('list_manifest_files', { directory: 'C:\\manifests', includeAvailability: true });
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

      const { profiles } = await discoverProfiles('/home/user/manifests');

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

      const { profiles } = await discoverProfiles('C:\\test');

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

      const { profiles } = await discoverProfiles('C:\\test');

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

      const { profiles } = await discoverProfiles('C:\\test');

      expect(profiles[0].name).toBe('MyProfile');
    });

    // A folder read failure used to look exactly like an empty folder.
    it('reports why the folder could not be read instead of returning an empty list', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Tauri invoke failed for 'list_manifest_files': Access is denied. (os error 5)"));

      const discovery = await discoverProfiles('C:\\invalid');

      expect(discovery.profiles).toEqual([]);
      expect(discovery.error).toBe('Access is denied. (os error 5)');
    });

    // The backend repeats the folder path in its reason; default UX shows no paths.
    it('describes an unreadable folder with its reason but without its path', async () => {
      const folder = 'C:\\Users\\someone\\Documents\\Old Profiles';
      vi.mocked(invoke).mockRejectedValue(new Error(`Directory does not exist: ${folder}`));

      const discovery = await discoverProfiles(folder);
      const message = describeUnreadableProfilesFolder(folder, discovery.error!);

      expect(message).toBe("Couldn't read your profiles folder: Directory does not exist: the folder");
      expect(message).not.toContain('Users');
    });

    // The validator's "File does not exist: <path>" reason would leak the path.
    it('names a skipped file without repeating its path', () => {
      const file = 'C:\\Users\\someone\\Documents\\Endstate\\Setups\\gone.jsonc';

      const message = describeSkippedProfiles([{ path: file, reason: `File does not exist: ${file}` }]);

      expect(message).toBe("gone.jsonc in your profiles folder isn't a profile Endstate can use, so it isn't listed (File does not exist: gone.jsonc).");
    });

    it('handles empty result from invoke', async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const { profiles } = await discoverProfiles('C:\\empty');

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

      const { profiles } = await discoverProfiles('C:\\manifests');

      // Should only include setup files, not .meta.json files
      expect(profiles).toHaveLength(2);
      expect(profiles.map(p => p.name)).toEqual(['setup_laptop', 'setup_desktop']);
      expect(profiles.map(p => p.path)).not.toContain('C:\\manifests\\setup_laptop.meta.json');
      expect(profiles.map(p => p.path)).not.toContain('C:\\manifests\\setup_desktop.meta.json');
    });
  });

  describe('discoverProfileDescriptors', () => {
    // Every captured bundle extracts metadata.json beside manifest.jsonc; it was
    // reported as "isn't a profile" after each import.
    it('lists an extracted capture bundle without a skip notice for its metadata', async () => {
      const bundleFixture = resolve(process.cwd(), 'tests/fixtures/profile-inspect-profile');
      const profilesDir = 'C:\\Setups';
      // The same one-level listing list_manifest_files returns for an extracted bundle.
      const listed = readdirSync(bundleFixture)
        .filter((name) => /\.(json|jsonc|json5)$/i.test(name))
        .map((name) => `${profilesDir}\\old-pc\\${name}`);
      expect(listed.map((path) => path.split('\\').pop())).toEqual(
        expect.arrayContaining(['manifest.jsonc', 'metadata.json']),
      );
      vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'list_manifest_files') return listed;
        if (cmd === 'validate_profile') {
          const path = (args as { path: string }).path;
          return path.endsWith('manifest.jsonc')
            ? validResult('old-pc')
            : invalidResult('MISSING_VERSION', "No 'version' field present");
        }
        if (cmd === 'check_file_exists') return false;
        return null;
      });

      const discovery = await discoverProfileDescriptors(profilesDir);

      expect(discovery.descriptors.map((d) => d.id)).toEqual(['old-pc']);
      expect(discovery.skipped).toEqual([]);
      expect(describeSkippedProfiles(discovery.skipped)).toBeNull();
    });

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

      const { descriptors } = await discoverProfileDescriptors('C:\\manifests');

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

      const { descriptors } = await discoverProfileDescriptors('C:\\manifests');

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

      const { descriptors } = await discoverProfileDescriptors('C:\\manifests');

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

      const { descriptors } = await discoverProfileDescriptors('C:\\manifests');

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

      const { descriptors, skipped } = await discoverProfileDescriptors('C:\\manifests');

      // Only valid_profile.json should be included
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].id).toBe('valid_profile');
      // The invalid files are reported with the validator's reason, not dropped.
      expect(skipped).toEqual([
        { path: 'C:\\manifests\\invalid_no_version.json', reason: 'No version field' },
        { path: 'C:\\manifests\\invalid_no_apps.json', reason: 'No version field' },
      ]);
    });

    it('includes summary from validation result', async () => {
      vi.mocked(invoke)
        .mockImplementation(async (cmd: string) => {
          if (cmd === 'list_manifest_files') return ['C:\\manifests\\my_profile.jsonc'];
          if (cmd === 'validate_profile') return validResult('My Profile', 42);
          if (cmd === 'check_file_exists') return false;
          return null;
        });

      const { descriptors } = await discoverProfileDescriptors('C:\\manifests');

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

    // The reason reaches a user-facing notice, so the bridge prefix must not.
    it('returns error result on invoke failure', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Tauri invoke failed for 'validate_profile': Engine not available"));

      const result = await validateProfile('C:\\test\\profile.json');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');
      expect(result.errors[0].message).toBe('Engine not available');
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

describe('sync folder availability', () => {
  beforeEach(() => vi.clearAllMocks());
  it('does not validate or open online-only profiles or sidecars', async () => {
    vi.mocked(invoke).mockImplementation(async cmd => {
      if (cmd === 'list_manifest_files') return [
        { path: 'C:/Setups/offline.jsonc', availability: 'online-only', metadataAvailable: false },
        { path: 'C:/Setups/local.jsonc', availability: 'local', metadataAvailable: false },
      ];
      if (cmd === 'validate_profile') return validResult();
      throw new Error('Unexpected content read');
    });
    const { descriptors: profiles } = await discoverProfileDescriptors('C:/Setups');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].availability).toBe('online-only');
    expect(invoke).toHaveBeenCalledWith('validate_profile', { path: 'C:/Setups/local.jsonc' });
    expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'validate_profile')).toHaveLength(1);
    expect(vi.mocked(invoke).mock.calls.some(([cmd]) => cmd === 'read_text_file' || cmd === 'check_file_exists')).toBe(false);
  });
  it('reports a storage folder that does not exist yet as empty, not as an error', async () => {
    vi.mocked(invoke).mockImplementation(async cmd => {
      if (cmd === 'list_manifest_files') return { entries: [], folderMissing: true };
      throw new Error('Unexpected command');
    });
    const discovery = await discoverProfileDescriptors('C:/OneDrive/Endstate');
    expect(discovery).toEqual({ descriptors: [], skipped: [], error: null, folderMissing: true });
  });
  it('reads entries from the native object response', async () => {
    vi.mocked(invoke).mockImplementation(async cmd => {
      if (cmd === 'list_manifest_files') return { entries: [{ path: 'C:/Setups/local.jsonc', availability: 'local', metadataAvailable: false }], folderMissing: false };
      if (cmd === 'validate_profile') return validResult();
      return null;
    });
    const { descriptors, folderMissing } = await discoverProfileDescriptors('C:/Setups');
    expect(descriptors.map(d => d.setupPath)).toEqual(['C:/Setups/local.jsonc']);
    expect(folderMissing).toBeUndefined();
  });
  it('keeps duplicate conflict labels distinct by path and filename', async () => {
    vi.mocked(invoke).mockImplementation(async cmd => {
      if (cmd === 'list_manifest_files') return ['C:/Setups/setup.jsonc', 'C:/Setups/setup (conflicted copy).jsonc'];
      if (cmd === 'validate_profile') return validResult();
      if (cmd === 'check_file_exists') return true;
      if (cmd === 'read_text_file') return JSON.stringify({ displayName: 'My setup' });
      return null;
    });
    const { descriptors: profiles } = await discoverProfileDescriptors('C:/Setups');
    expect(profiles.map(p => p.setupPath)).toHaveLength(2);
    expect(profiles[0].label).toBe('My setup (setup.jsonc)');
    expect(profiles[1].label).toBe('My setup (setup (conflicted copy).jsonc)');
  });
});
