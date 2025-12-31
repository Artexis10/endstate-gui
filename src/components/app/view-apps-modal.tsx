import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invoke } from '@/lib/tauri-bridge';
import { parseJsonc, type ProfileApp } from '@/lib/jsonc-parse';
import { Search, Package, ChevronDown, ChevronRight, Copy, FileText } from 'lucide-react';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { copyText } from '@/lib/clipboard';

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
  const diagnosticsFeedback = useMicroFeedback();
  const pathFeedback = useMicroFeedback();

  useEffect(() => {
    if (open && profilePath) {
      loadProfileApps(profilePath).then((result) => {
        setApps(result.apps || []);
      });
      // Reset state when opening
      setSearchQuery('');
      setTechnicalExpanded(false);
    }
  }, [open, profilePath]);

  // Filter apps by search query (search both id and name if available)
  const filteredApps = searchQuery.trim()
    ? apps.filter(app => {
        const query = searchQuery.toLowerCase();
        const matchesId = app.id.toLowerCase().includes(query);
        const matchesName = app.name?.toLowerCase().includes(query);
        return matchesId || matchesName;
      })
    : apps;

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
      <DialogContent className="sm:max-w-[480px] h-[85vh] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">{profileDisplayName || 'Profile Details'}</DialogTitle>
        </DialogHeader>

        {/* Apps count - prominent */}
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
          <span className="text-sm font-medium">Apps captured</span>
          <span className="text-xl font-semibold">{apps.length}</span>
        </div>

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

        {/* Scrollable content area for list + technical details */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 -mx-6 px-6">
          {/* Simple app list */}
          <div className="border rounded-md">
            {filteredApps.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No apps match your search' : 'No apps in profile'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredApps.map((app, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                      <span className="truncate">{app.name || app.id}</span>
                      {app.name && (
                        <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{app.id}</span>
                      )}
                    </div>
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
          )}
          </div>
        </div>

        <DialogFooter className="pt-2 flex-shrink-0">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
