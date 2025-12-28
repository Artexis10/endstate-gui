import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Search, AlertCircle } from 'lucide-react';
import { invoke } from '@/lib/tauri-bridge';
import { parseJsonc, type ProfileApp } from '@/lib/jsonc-parse';

interface ViewAppsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profilePath: string;
  profileDisplayName: string;
}

interface ParsedProfile {
  apps: ProfileApp[];
  error?: string;
}

async function loadProfileApps(path: string): Promise<ParsedProfile> {
  try {
    const content = await invoke<string>('read_text_file', { path });
    const parsed = parseJsonc<{ apps?: ProfileApp[] }>(content);
    
    if (!parsed.apps || !Array.isArray(parsed.apps)) {
      return { apps: [], error: 'Profile has no apps array' };
    }
    
    return { apps: parsed.apps };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { apps: [], error: `Failed to parse profile: ${message}` };
  }
}

export function ViewAppsModal({
  open,
  onOpenChange,
  profilePath,
  profileDisplayName,
}: ViewAppsModalProps) {
  const [apps, setApps] = useState<ProfileApp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open && profilePath) {
      setLoading(true);
      setError(null);
      setSearch('');
      loadProfileApps(profilePath).then((result) => {
        setApps(result.apps);
        setError(result.error || null);
        setLoading(false);
      });
    }
  }, [open, profilePath]);

  const filteredApps = apps.filter((app) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      app.id.toLowerCase().includes(searchLower) ||
      (app.name && app.name.toLowerCase().includes(searchLower))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{profileDisplayName}</DialogTitle>
          <DialogDescription>
            {loading ? 'Loading...' : `${apps.length} app${apps.length === 1 ? '' : 's'} in this profile`}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-md text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md min-h-[200px] max-h-[400px]">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading apps...
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {search ? 'No apps match your search' : 'No apps in this profile'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredApps.map((app, idx) => (
                    <div key={`${app.id}-${idx}`} className="flex items-center gap-3 px-3 py-2">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        {app.name && (
                          <p className="text-sm font-medium truncate">{app.name}</p>
                        )}
                        <p className={`font-mono truncate ${app.name ? 'text-xs text-muted-foreground' : 'text-sm'}`}>
                          {app.id}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
