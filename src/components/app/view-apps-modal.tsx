import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invoke } from '@/lib/tauri-bridge';
import { parseJsonc, type ProfileApp } from '@/lib/jsonc-parse';
import { Search, Package, Copy, FileText } from 'lucide-react';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { copyText } from '@/lib/clipboard';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';

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
  const diagnosticsFeedback = useMicroFeedback();
  const pathFeedback = useMicroFeedback();

  useEffect(() => {
    if (open && profilePath) {
      loadProfileApps(profilePath).then((result) => {
        setApps(result.apps || []);
      });
      // Reset state when opening
      setSearchQuery('');
    }
  }, [open, profilePath]);

  // Filter apps by search query (search id, name, and winget ref)
  const filteredApps = searchQuery.trim()
    ? apps.filter(app => {
        const query = searchQuery.toLowerCase();
        const matchesId = app.id.toLowerCase().includes(query);
        const matchesName = app.name?.toLowerCase().includes(query);
        const matchesWinget = app.refs?.windows?.toLowerCase().includes(query);
        return matchesId || matchesName || matchesWinget;
      })
    : apps;

  // Get display identifier: prefer Winget ID, fallback to app.id
  const getDisplayId = (app: ProfileApp): string => {
    return app.refs?.windows ?? app.id;
  };

  const copyDiagnostics = async () => {
    const diagnostics = [
      '=== Profile Diagnostics ===',
      `Profile: ${profileDisplayName}`,
      `Path: ${profilePath}`,
      `Apps: ${apps.length}`,
      '',
      '--- Apps List ---',
      ...filteredApps.map(a => `  - ${a.id}${a.name ? ` (${a.name})` : ''}`),
    ].join('\n');

    await diagnosticsFeedback.triggerAsync(
      () => copyText(diagnostics),
      'Copied',
      'Copy failed'
    );
  };

  const copyPath = async () => {
    await pathFeedback.triggerAsync(
      () => copyText(profilePath),
      'Copied',
      'Copy failed'
    );
  };

  const displayPath = profilePath ? profilePath.split('\\').pop() || profilePath : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-2 pr-8">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">Profile: {profileDisplayName || 'Untitled'}</DialogTitle>
              <div className="text-xs text-muted-foreground pt-1">
                <span className="font-mono">{displayPath}</span>
              </div>
            </div>
            <div className="flex-shrink-0 px-2 py-1 rounded-md bg-muted/50 text-xs font-medium">
              {apps.length} {apps.length === 1 ? 'app' : 'apps'}
            </div>
          </div>
        </DialogHeader>

        {/* Search input */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Scrollable app list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="border rounded-md">
            {filteredApps.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No apps match your search' : 'No apps in profile'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredApps.map((app, idx) => {
                  const displayId = getDisplayId(app);
                  return (
                    <div key={idx} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {/* Show single identifier: Winget ID if available, else app.id */}
                          <div className="text-sm font-mono truncate" title={displayId}>
                            {displayId}
                          </div>
                          {/* Show friendly name and driver/source as secondary info */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {app.name && <span className="truncate">{app.name}</span>}
                            {app.driver && (
                              <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                                {app.driver}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Details disclosure - only renders when setting is enabled */}
        <DetailsDisclosure title="Details" className="flex-shrink-0 border-t pt-3">
          <div className="space-y-2">
            {/* File path */}
            <div className="p-2 bg-muted/30 rounded text-xs">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Path:</span>
                <span className="font-mono truncate flex-1">{profilePath}</span>
                <Button
                  ref={pathFeedback.buttonRef}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 relative"
                  onClick={copyPath}
                >
                  <Copy className="h-3 w-3" />
                  <InlineFeedbackPopover feedback={pathFeedback.feedback} />
                </Button>
              </div>
            </div>

            {/* Copy diagnostics */}
            <Button
              ref={diagnosticsFeedback.buttonRef}
              variant="ghost"
              size="sm"
              onClick={copyDiagnostics}
              className="h-7 text-xs gap-1 relative"
            >
              <Copy className="h-3 w-3" />
              Copy diagnostics
              <InlineFeedbackPopover feedback={diagnosticsFeedback.feedback} />
            </Button>
          </div>
        </DetailsDisclosure>

        <DialogFooter className="pt-2 flex-shrink-0">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
