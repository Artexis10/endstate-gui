import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverProfiles, discoverProfileDescriptors, getMetaPath } from './file-discovery';
import { invoke } from './lib/tauri-bridge';

vi.mock('./lib/tauri-bridge', () => ({
  invoke: vi.fn(),
}));

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

    it('maps file paths to profile objects', async () => {
      vi.mocked(invoke).mockResolvedValue([
        'C:\\manifests\\Hugo-Laptop.jsonc',
        'C:\\manifests\\Test-Profile.json',
        'C:\\manifests\\Another.json5',
      ]);

      const profiles = await discoverProfiles('C:\\manifests');

      expect(profiles).toEqual([
        { name: 'Hugo-Laptop', path: 'C:\\manifests\\Hugo-Laptop.jsonc' },
        { name: 'Test-Profile', path: 'C:\\manifests\\Test-Profile.json' },
        { name: 'Another', path: 'C:\\manifests\\Another.json5' },
      ]);
      expect(invoke).toHaveBeenCalledWith('list_manifest_files', { directory: 'C:\\manifests' });
    });

    it('handles Unix-style paths', async () => {
      vi.mocked(invoke).mockResolvedValue([
        '/home/user/manifests/Profile1.jsonc',
        '/home/user/manifests/Profile2.json',
      ]);

      const profiles = await discoverProfiles('/home/user/manifests');

      expect(profiles).toEqual([
        { name: 'Profile1', path: '/home/user/manifests/Profile1.jsonc' },
        { name: 'Profile2', path: '/home/user/manifests/Profile2.json' },
      ]);
    });

    it('strips .jsonc extension', async () => {
      vi.mocked(invoke).mockResolvedValue(['C:\\test\\MyProfile.jsonc']);

      const profiles = await discoverProfiles('C:\\test');

      expect(profiles[0].name).toBe('MyProfile');
    });

    it('strips .json extension', async () => {
      vi.mocked(invoke).mockResolvedValue(['C:\\test\\MyProfile.json']);

      const profiles = await discoverProfiles('C:\\test');

      expect(profiles[0].name).toBe('MyProfile');
    });

    it('strips .json5 extension', async () => {
      vi.mocked(invoke).mockResolvedValue(['C:\\test\\MyProfile.json5']);

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
      vi.mocked(invoke).mockResolvedValue([
        'C:\\manifests\\setup_laptop.json',
        'C:\\manifests\\setup_laptop.meta.json',
        'C:\\manifests\\setup_desktop.jsonc',
        'C:\\manifests\\setup_desktop.meta.json',
      ]);

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
        .mockResolvedValueOnce([
          'C:\\manifests\\setup_laptop.json',
          'C:\\manifests\\setup_laptop.meta.json',
          'C:\\manifests\\setup_desktop.jsonc',
        ])
        .mockResolvedValueOnce(false) // check_file_exists for setup_laptop.meta.json
        .mockResolvedValueOnce(false); // check_file_exists for setup_desktop.meta.json

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
        .mockResolvedValueOnce(['C:\\manifests\\setup_laptop.json'])
        .mockResolvedValueOnce(true) // check_file_exists
        .mockResolvedValueOnce(JSON.stringify({ displayName: 'My Laptop' })); // read_text_file

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].displayName).toBe('My Laptop');
      expect(descriptors[0].label).toBe('My Laptop');
    });

    it('uses id as label when displayName is not present', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(['C:\\manifests\\setup_laptop.json'])
        .mockResolvedValueOnce(false); // check_file_exists - no meta file

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].displayName).toBeUndefined();
      expect(descriptors[0].label).toBe('setup_laptop');
    });

    it('never includes .meta.json files as selectable profiles', async () => {
      // This is a critical test - .meta.json files must NEVER appear as profiles
      vi.mocked(invoke).mockResolvedValueOnce([
        'C:\\manifests\\setup_work.json',
        'C:\\manifests\\setup_work.meta.json',
        'C:\\manifests\\config.meta.json',
        'C:\\manifests\\random.meta.json',
      ]);

      const descriptors = await discoverProfileDescriptors('C:\\manifests');

      // Only setup_work.json should be included
      expect(descriptors).toHaveLength(1);
      expect(descriptors[0].id).toBe('setup_work');
      
      // Verify no .meta.json paths in setupPath
      for (const d of descriptors) {
        expect(d.setupPath.toLowerCase()).not.toContain('.meta.json');
      }
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
