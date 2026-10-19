import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeStorageDestination, isWithinWindowsPath } from './storage-destination';
import { loadSettings, saveSettings, loadSettingsWithProfileMigration } from '../settings';
import { getProfilesDirectory, invoke } from './tauri-bridge';

describe('storage destination migration', () => {
  beforeEach(() => localStorage.clear());
  it.each(['', undefined, 42, null])('defaults invalid legacy data %s', value => {
    const settings = { customProfilesDirectory: value };
    normalizeStorageDestination(settings);
    expect(settings).toEqual({ storageDestination: null });
  });
  it('preserves paths byte for byte and persists no legacy key', async () => {
    const path = ' C:\\Users\\Joe\\OneDrive\\Endstate ';
    localStorage.setItem('web:endstate-gui-settings', JSON.stringify({ customProfilesDirectory: path }));
    const settings = loadSettings();
    expect(settings.storageDestination).toEqual({ kind: 'folder', path });
    expect(await getProfilesDirectory(settings.storageDestination)).toBe(path);
    saveSettings(settings);
    expect(JSON.parse(localStorage.getItem('web:endstate-gui-settings')!)).not.toHaveProperty('customProfilesDirectory');
    expect((await loadSettingsWithProfileMigration(path)).storageDestination).toEqual(settings.storageDestination);
  });
  it('preserves a nonempty legacy path even if it contains only spaces', () => {
    const settings: Record<string, unknown> = { customProfilesDirectory: '   ' };
    normalizeStorageDestination(settings);
    expect(settings.storageDestination).toEqual({ kind: 'folder', path: '   ' });
  });
  it('prefers a typed destination and rejects malformed shapes', () => {
    const settings = { customProfilesDirectory: 'legacy', storageDestination: { kind: 'folder', path: 'typed' } };
    normalizeStorageDestination(settings);
    expect(settings.storageDestination.path).toBe('typed');
    const invalid: Record<string, unknown> = { storageDestination: { kind: 'network', path: 1 }, customProfilesDirectory: 'legacy' };
    normalizeStorageDestination(invalid);
    expect(invalid).toEqual({ storageDestination: { kind: 'folder', path: 'legacy' } });
  });
  it('honors an explicit default and checks containment on path boundaries', () => {
    const settings = { storageDestination: null, customProfilesDirectory: 'legacy' };
    normalizeStorageDestination(settings);
    expect(settings).toEqual({ storageDestination: null });
    expect(isWithinWindowsPath('c:/OneDrive/Documents/Endstate', 'C:\\OneDrive\\')).toBe(true);
    expect(isWithinWindowsPath('C:\\OneDriveOther\\Docs', 'C:\\OneDrive')).toBe(false);
  });
  it('web discovery uses deterministic unsupported states', async () => {
    expect(await invoke('discover_sync_folders')).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'onedrive', status: 'unsupported', locations: [] }),
    ]));
  });
});
