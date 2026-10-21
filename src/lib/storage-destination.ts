export type StorageDestination = { kind: 'folder'; path: string };

/** Migration preserves user paths exactly, including whitespace and separators. */
export function normalizeStorageDestination(settings: Record<string, unknown>): void {
  const value = settings.storageDestination;
  const valid = value && typeof value === 'object' &&
    (value as StorageDestination).kind === 'folder' &&
    typeof (value as StorageDestination).path === 'string' &&
    (value as StorageDestination).path.length > 0;
  if (value === null) settings.storageDestination = null;
  else if (valid) settings.storageDestination = { kind: 'folder', path: (value as StorageDestination).path };
  else settings.storageDestination = typeof settings.customProfilesDirectory === 'string' && settings.customProfilesDirectory.length > 0
    ? { kind: 'folder', path: settings.customProfilesDirectory } : null;
  delete settings.customProfilesDirectory;
}

export type SyncProvider = 'onedrive' | 'google-drive' | 'dropbox';
export interface SyncFolderLocation { id: string; provider: SyncProvider; label: string; path: string }
export interface SyncProviderDiscovery {
  provider: SyncProvider;
  status: 'detected' | 'not-detected' | 'error' | 'unsupported';
  locations: SyncFolderLocation[];
  message?: string;
}
export const PROVIDER_NAMES: Record<SyncProvider, string> = {
  onedrive: 'OneDrive', 'google-drive': 'Google Drive', dropbox: 'Dropbox',
};
export const unsupportedSyncFolders = (): SyncProviderDiscovery[] =>
  (Object.keys(PROVIDER_NAMES) as SyncProvider[]).map(provider => ({
    provider, status: 'unsupported', locations: [], message: 'Automatic discovery is available on Windows. You can still choose a custom folder.',
  }));

function windowsPath(path: string): string { return path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase(); }
export function isWithinWindowsPath(path: string, root: string): boolean {
  const p = windowsPath(path), r = windowsPath(root);
  return p === r || p.startsWith(`${r}\\`);
}
export function syncDestination(root: string): StorageDestination {
  return { kind: 'folder', path: `${root.replace(/[\\/]+$/, '')}\\Endstate` };
}
