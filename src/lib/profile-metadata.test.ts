import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteProfileFiles } from './profile-metadata';

vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
}));

describe('Profile Metadata - deleteProfileFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes both setup file and .meta.json sibling', async () => {
    const { invoke } = await import('./tauri-bridge');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'check_file_exists') return true;
      if (cmd === 'delete_file') return null;
      return null;
    });

    const setupPath = 'C:\\profiles\\test-profile.jsonc';
    await deleteProfileFiles(setupPath);

    expect(mockInvoke).toHaveBeenCalledWith('delete_file', { path: setupPath });
    expect(mockInvoke).toHaveBeenCalledWith('delete_file', { path: 'C:\\profiles\\test-profile.meta.json' });
  });

  it('handles missing .meta.json gracefully', async () => {
    const { invoke } = await import('./tauri-bridge');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'check_file_exists') return false;
      if (cmd === 'delete_file') return null;
      return null;
    });

    const setupPath = 'C:\\profiles\\test-profile.jsonc';
    
    await expect(deleteProfileFiles(setupPath)).resolves.not.toThrow();

    expect(mockInvoke).toHaveBeenCalledWith('delete_file', { path: setupPath });
    expect(mockInvoke).toHaveBeenCalledWith('check_file_exists', { path: 'C:\\profiles\\test-profile.meta.json' });
    expect(mockInvoke).not.toHaveBeenCalledWith('delete_file', { path: 'C:\\profiles\\test-profile.meta.json' });
  });
});
