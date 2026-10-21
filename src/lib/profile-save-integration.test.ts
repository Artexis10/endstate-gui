import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveNewProfile, saveProfileMetadata } from './profile-metadata';
import { invoke } from './tauri-bridge';
vi.mock('./tauri-bridge', () => ({ invoke: vi.fn() }));
beforeEach(() => { vi.mocked(invoke).mockReset(); });
describe('native profile save integration', () => {
  it('sends complete manifest and separate metadata in one transaction', async () => {
    const content = JSON.stringify({ version: 1, apps: [] });
    await saveNewProfile('D:/Setups/profile.jsonc', content, 'My setup');
    expect(invoke).toHaveBeenCalledExactlyOnceWith('save_profile', {
      path: 'D:/Setups/profile.jsonc', content, metadata: JSON.stringify({ displayName: 'My setup' }, null, 2), createNew: true,
    });
  });
  it('omits optional metadata without changing the manifest', async () => {
    await saveNewProfile('D:/Setups/empty.jsonc', '{"version":1,"apps":[]}');
    expect(invoke).toHaveBeenCalledWith('save_profile', expect.objectContaining({ metadata: null, createNew: true }));
  });
  it('refuses empty drafts and propagates lock failures to the save UI', async () => {
    await expect(saveNewProfile('D:/Setups/profile.jsonc', ' ')).rejects.toThrow('No capture draft');
    expect(invoke).not.toHaveBeenCalled();
    vi.mocked(invoke).mockRejectedValue(new Error('Storage busy'));
    await expect(saveNewProfile('D:/Setups/profile.jsonc', 'data')).rejects.toThrow('Storage busy');
  });
  it('renames metadata atomically without rewriting the manifest', async () => {
    await saveProfileMetadata('D:/Setups/profile.jsonc', { displayName: 'New label' });
    expect(invoke).toHaveBeenCalledExactlyOnceWith('save_profile', {
      path: 'D:/Setups/profile.meta.json', content: JSON.stringify({ displayName: 'New label' }, null, 2), metadata: null, createNew: false,
    });
  });
});
