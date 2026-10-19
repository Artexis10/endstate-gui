import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageLocation } from './storage-location';
import { invoke, browseStorageFolder, getProfilesDirectory } from '@/lib/tauri-bridge';
import { unsupportedSyncFolders } from '@/lib/storage-destination';

vi.mock('@/lib/tauri-bridge', () => ({ invoke: vi.fn(), browseStorageFolder: vi.fn(), getProfilesDirectory: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProfilesDirectory).mockResolvedValue('C:\\OneDrive\\Documents\\Endstate\\Setups');
  vi.mocked(invoke).mockResolvedValue([
    { provider: 'onedrive', status: 'detected', locations: [
      { id: 'one', provider: 'onedrive', label: 'OneDrive personal', path: 'C:\\OneDrive' },
      { id: 'two', provider: 'onedrive', label: 'OneDrive business', path: 'D:\\Work' },
    ] },
    { provider: 'google-drive', status: 'error', locations: [], message: 'Cannot read Google Drive account data' },
    { provider: 'dropbox', status: 'not-detected', locations: [] },
  ]);
});
describe('Storage location', () => {
  it('keeps the default null and labels OneDrive Known Folder Move truthfully', async () => {
    const onChange = vi.fn();
    render(<StorageLocation destination={null} onChange={onChange} />);
    expect(await screen.findByText('Synced with OneDrive')).toBeVisible();
    expect(screen.getByRole('radio', { name: /Documents \(default\)/ })).toHaveAttribute('aria-checked', 'true');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/aren't encrypted by Endstate/)).toBeVisible();
  });
  it('lists both accounts and selects the Endstate folder without invoking backup', async () => {
    const onChange = vi.fn();
    render(<StorageLocation destination={null} onChange={onChange} />);
    fireEvent.click(await screen.findByRole('radio', { name: /OneDrive business/ }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'folder', path: 'D:\\Work\\Endstate' });
    expect(screen.getByText(/Cannot read Google Drive account data/)).toBeVisible();
    expect(screen.getByText(/Dropbox: Not detected/)).toBeVisible();
    expect(vi.mocked(invoke).mock.calls.map(([cmd]) => cmd)).toEqual(['discover_sync_folders']);
  });
  it('retains exact custom text and allows browsing and switching back to default', async () => {
    const onChange = vi.fn();
    vi.mocked(browseStorageFolder).mockResolvedValue('E:\\My setups');
    render(<StorageLocation destination={{ kind: 'folder', path: 'Z:\\Unavailable' }} onChange={onChange} />);
    expect(screen.getByRole('textbox', { name: 'Custom storage folder' })).toHaveValue('Z:\\Unavailable');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' D:\\Exact path ' } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'folder', path: ' D:\\Exact path ' });
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ kind: 'folder', path: 'E:\\My setups' }));
    fireEvent.click(screen.getByRole('radio', { name: /Documents \(default\)/ }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('keeps unsupported providers visible and reports picker failures', async () => {
    vi.mocked(invoke).mockResolvedValue(unsupportedSyncFolders());
    vi.mocked(browseStorageFolder).mockRejectedValue(new Error('Picker unavailable'));
    render(<StorageLocation destination={null} onChange={vi.fn()} />);
    expect(await screen.findAllByText(/Automatic discovery is available on Windows/)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Picker unavailable');
  });
});
