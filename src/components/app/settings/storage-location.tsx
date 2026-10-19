import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { browseStorageFolder, getProfilesDirectory, invoke } from '@/lib/tauri-bridge';
import { PROVIDER_NAMES, isWithinWindowsPath, syncDestination, unsupportedSyncFolders, type StorageDestination, type SyncProviderDiscovery } from '@/lib/storage-destination';

export function StorageLocation({ destination, onChange }: {
  destination: StorageDestination | null;
  onChange: (destination: StorageDestination | null) => void;
}) {
  const [providers, setProviders] = useState<SyncProviderDiscovery[]>([]);
  const [defaultPath, setDefaultPath] = useState('');
  const [error, setError] = useState('');
  const [custom, setCustom] = useState(false);
  useEffect(() => { if (destination === null) setCustom(false); }, [destination]);
  useEffect(() => {
    let cancelled = false;
    getProfilesDirectory(null).then(path => { if (!cancelled) setDefaultPath(path); })
      .catch(e => { if (!cancelled) setError(String(e)); });
    invoke<SyncProviderDiscovery[]>('discover_sync_folders').then(results => {
      if (!cancelled) setProviders(results);
    }).catch(() => {
      if (!cancelled) setProviders(unsupportedSyncFolders().map(p => ({ ...p, status: 'error', message: 'Discovery failed. Choose a custom folder or try again after reopening Settings.' })));
    });
    return () => { cancelled = true; };
  }, []);
  const locations = providers.flatMap(p => p.locations);
  const selected = custom ? 'custom' : destination === null ? 'default' :
    (!custom && locations.find(l => isWithinWindowsPath(destination.path, syncDestination(l.path).path) &&
      isWithinWindowsPath(syncDestination(l.path).path, destination.path))?.id) || 'custom';
  const syncedDefault = providers.find(p => p.provider === 'onedrive')?.locations.some(l => isWithinWindowsPath(defaultPath, l.path));
  return <Card>
    <CardHeader>
      <CardTitle>Storage location</CardTitle>
      <CardDescription>Choose where Endstate reads and saves your setups.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <RadioGroup aria-label="Storage location" value={selected} onValueChange={value => {
        setCustom(value === 'custom');
        if (value === 'default') onChange(null);
        else if (value !== 'custom') {
          const location = locations.find(l => l.id === value);
          if (location) onChange(syncDestination(location.path));
        }
      }}>
        <div className="flex items-start gap-2">
          <RadioGroupItem id="storage-default" value="default" />
          <label htmlFor="storage-default" className="text-sm">Documents (default)
            {syncedDefault && <span className="block text-xs text-muted-foreground">Synced with OneDrive</span>}
            <span className="block text-xs text-muted-foreground break-all">{defaultPath}</span>
          </label>
        </div>
        {providers.length === 0 && <p className="text-sm text-muted-foreground">Looking for sync folders...</p>}
        {providers.map(provider => <div key={provider.provider} className="space-y-2">
          {provider.locations.map(location => <div key={location.id} className="flex items-start gap-2">
            <RadioGroupItem id={`storage-${location.id}`} value={location.id} />
            <label htmlFor={`storage-${location.id}`} className="text-sm">{location.label}
              <span className="block text-xs text-muted-foreground break-all">{syncDestination(location.path).path}</span>
            </label>
          </div>)}
          {(provider.status !== 'detected') && <p className="text-xs text-muted-foreground">
            {PROVIDER_NAMES[provider.provider]}: {provider.message || 'Not detected. Install and set up the sync app, or choose its folder manually.'}
          </p>}
        </div>)}
        <div className="flex items-center gap-2">
          <RadioGroupItem id="storage-custom" value="custom" />
          <label htmlFor="storage-custom" className="text-sm">Custom folder</label>
        </div>
      </RadioGroup>
      <div className="flex gap-2">
        <Input aria-label="Custom storage folder" value={destination?.path || ''}
          placeholder="Enter a folder path" onChange={e => {
            setCustom(true);
            onChange(e.target.value.trim() ? { kind: 'folder', path: e.target.value } : null);
          }} />
        <Button variant="secondary" onClick={async () => {
          try {
            setError('');
            const folder = await browseStorageFolder();
            if (folder) { setCustom(true); onChange({ kind: 'folder', path: folder }); }
          } catch (e) { setError(String(e)); }
        }}>Browse</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Files in this location sync as-is and aren&apos;t encrypted by Endstate.</p>
    </CardContent>
  </Card>;
}
