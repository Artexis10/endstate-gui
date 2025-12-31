import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invoke } from '@/lib/tauri-bridge';
import { parseJsonc, type ProfileApp } from '@/lib/jsonc-parse';
import { Search, Package, ChevronDown, ChevronRight, Copy, FileText } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [technicalExpanded, setTechnicalExpanded] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && profilePath) {
      loadProfileApps(profilePath).then((result) => {
        setApps(result.apps || []);
      });
      // Reset state when opening
      setSearchQuery('');
      setTechnicalExpanded(false);
      setSourceExpanded(new Set());
    }
  }, [open, profilePath]);

  // Filter apps by search query
  const filteredApps = searchQuery.trim()
    ? apps.filter(app => app.id.toLowerCase().includes(searchQuery.toLowerCase()))
    : apps;

  // Group apps by source/driver
  const appsBySource = filteredApps.reduce((acc, app) => {
    const source = app.driver || 'winget';
    if (!acc[source]) acc[source] = [];
    acc[source].push(app);
    return acc;
  }, {} as Record<string, ProfileApp[]>);

  const toggleSource = (source: string) => {
    const next = new Set(sourceExpanded);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    setSourceExpanded(next);
  };

  const copyDiagnostics = async () => {
    const diagnostics = [
      '=== Profile Diagnostics ===',
      `Profile: ${profileDisplayName}`,
      `Path: ${profilePath}`,
      `Apps: ${apps.length}`,
      '',
      '--- Apps by Source ---',
      ...Object.entries(appsBySource).flatMap(([source, sourceApps]) => [
        `${source} (${sourceApps.length}):`,
        ...sourceApps.map(a => `  - ${a.id}`),
      ]),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const displayPath = profilePath ? profilePath.split('\\').pop() || profilePath : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">{profileDisplayName || 'Profile Details'}</DialogTitle>
        </DialogHeader>

        {/* Apps count - prominent */}
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
          <span className="text-sm font-medium">Apps captured</span>
          <span className="text-xl font-semibold">{apps.length}</span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Simple app list */}
        <div className="flex-1 overflow-y-auto border rounded-md min-h-[120px] max-h-[240px]">
          {filteredApps.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No apps match your search' : 'No apps in profile'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredApps.map((app, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono text-xs truncate flex-1">{app.id}</span>
                  <span className="text-xs text-muted-foreground">{app.driver || 'winget'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technical details accordion */}
        <div className="border-t pt-3">
          <button
            onClick={() => setTechnicalExpanded(!technicalExpanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
          >
            {technicalExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Technical details
          </button>

          {technicalExpanded && (
            <div className="mt-2 space-y-2">
              {/* File path */}
              <div className="p-2 bg-muted/30 rounded text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">File:</span>
                  <span className="font-mono truncate flex-1">{displayPath}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => navigator.clipboard.writeText(profilePath)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Source breakdown */}
              {Object.keys(appsBySource).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Source breakdown:</span>
                  {Object.entries(appsBySource).map(([source, sourceApps]) => (
                    <div key={source} className="border rounded">
                      <button
                        onClick={() => toggleSource(source)}
                        className="flex items-center justify-between w-full p-2 text-xs hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          {sourceExpanded.has(source) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <span className="font-medium capitalize">{source}</span>
                        </div>
                        <span className="text-muted-foreground">{sourceApps.length}</span>
                      </button>
                      {sourceExpanded.has(source) && (
                        <div className="border-t max-h-24 overflow-y-auto">
                          {sourceApps.map((app, idx) => (
                            <div key={idx} className="px-3 py-1 text-xs font-mono border-b last:border-b-0">
                              {app.id}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Copy diagnostics */}
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDiagnostics}
                className="h-7 text-xs gap-1"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy diagnostics'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
