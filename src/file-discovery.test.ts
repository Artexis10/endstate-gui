import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverProfiles } from './file-discovery';
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
  });
});
