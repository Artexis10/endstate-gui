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

describe('Profile Metadata - profilePathTaken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats a sidecar left without its manifest as a taken name', async () => {
    const { invoke } = await import('./tauri-bridge');
    const { profilePathTaken } = await import('./profile-metadata');
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (_cmd: string, args: { path: string }) =>
      args.path === 'C:\profiles\My_setup.meta.json');

    expect(await profilePathTaken('C:\profiles\My_setup.jsonc')).toBe(true);
    expect(await profilePathTaken('C:\profiles\Other.jsonc')).toBe(false);
  });
});
