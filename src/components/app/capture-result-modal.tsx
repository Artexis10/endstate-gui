import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { CheckCircle2, Copy, Package, ChevronDown, ChevronRight, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { DetailsDisclosure } from '../ui/details-disclosure';
import type { CapturedApp, CaptureCounts } from '../../types';
import { useMicroFeedback } from '@/lib/micro-feedback';
import { InlineFeedbackPopover } from '@/components/ui/inline-feedback-popover';
import { copyText } from '@/lib/clipboard';

interface CaptureResultModalProps {
  open: boolean;
  onClose: () => void;
  onGoToApply?: () => void;
  counts: CaptureCounts;
  appsIncluded: CapturedApp[];
  outputPath: string;
  rawLogs?: string;
  rawEnvelope?: object;
  enableSearch?: boolean;
  customTitle?: string;
}

export function CaptureResultModal({
  open,
  onClose,
  onGoToApply,
  counts,
  appsIncluded,
  outputPath,
  rawLogs,
  rawEnvelope,
  enableSearch = false,
  customTitle,
}: CaptureResultModalProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const diagnosticsFeedback = useMicroFeedback(2000);
  const pathFeedback = useMicroFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const displayPath = outputPath ? outputPath.split('\\').pop() || outputPath : '';

  // Filter apps by search query
  const filteredApps = searchQuery.trim()
    ? appsIncluded.filter(app => 
        app.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : appsIncluded;

  // Group apps by source
  const appsBySource = filteredApps.reduce((acc, app) => {
    const source = app.source || 'winget';
    if (!acc[source]) acc[source] = [];
    acc[source].push(app);
    return acc;
  }, {} as Record<string, CapturedApp[]>);

  const toggleSource = (source: string) => {
    const next = new Set(expandedSources);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    setExpandedSources(next);
  };

  const copyDiagnostics = async () => {
    const diagnostics = [
      '=== Capture Diagnostics ===',
      `Output: ${outputPath}`,
      `Apps captured: ${counts.included}`,
      '',
      '--- Apps by Source ---',
      ...Object.entries(appsBySource).flatMap(([source, apps]) => [
        `${source} (${apps.length}):`,
        ...apps.map(a => `  - ${a.id}`),
      ]),
      '',
      '--- Raw Envelope ---',
      rawEnvelope ? JSON.stringify(rawEnvelope, null, 2) : '(not available)',
      '',
      '--- Logs ---',
      rawLogs || '(not available)',
    ].join('\n');

    await diagnosticsFeedback.triggerAsync(
      () => copyText(diagnostics),
      'Copied',
      'Copy failed'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <DialogTitle className="text-2xl">{customTitle || 'Profile created'}</DialogTitle>
          </div>
          {outputPath && (
            <DialogDescription className="text-sm pt-2 font-mono text-muted-foreground">
              Saved to: {displayPath}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Non-technical summary */}
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm font-medium">Apps captured</span>
            <span className="text-2xl font-semibold text-success">{counts.included}</span>
          </div>
          
          {counts.skipped > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
              <span className="text-sm font-medium">Skipped</span>
              <span className="text-2xl font-semibold text-muted-foreground">{counts.skipped}</span>
            </div>
          )}
          
          {counts.sensitiveExcludedCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Excluded for safety</span>
                <span className="text-xs text-muted-foreground" title="Sensitive paths like SSH keys, credentials, and browser data are never captured">(security)</span>
              </div>
              <span className="text-2xl font-semibold text-muted-foreground">{counts.sensitiveExcludedCount}</span>
            </div>
          )}
        </div>

        {/* Details expander (technical) */}
        {appsIncluded.length > 0 && (
          <div className="border-t border-border pt-4">
            {enableSearch && (
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search apps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            <DetailsDisclosure title={`Details (${searchQuery ? `${filteredApps.length} of ${appsIncluded.length}` : appsIncluded.length} apps)`}>
              <div className="space-y-3">
                {/* Apps grouped by source */}
                {Object.entries(appsBySource).map(([source, apps]) => (
                  <div key={source} className="border border-border rounded-lg">
                    <button
                      onClick={() => toggleSource(source)}
                      className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSources.has(source) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="text-sm font-medium capitalize">{source}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{apps.length} apps</span>
                    </button>
                    
                    {expandedSources.has(source) && (
                      <div className="border-t border-border max-h-48 overflow-y-auto">
                        {apps.map((app, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0">
                            <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono truncate">{app.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Copy diagnostics */}
                <div className="flex justify-end">
                  <Button
                    ref={diagnosticsFeedback.buttonRef}
                    variant="ghost"
                    size="sm"
                    onClick={copyDiagnostics}
                    className="h-8 gap-2 relative"
                  >
                    <Copy className="h-3 w-3" />
                    Copy diagnostics
                    <InlineFeedbackPopover feedback={diagnosticsFeedback.feedback} />
                  </Button>
                </div>
              </div>
            </DetailsDisclosure>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {onGoToApply && (
            <Button onClick={() => { onClose(); onGoToApply(); }} className="w-full">
              Next: Set up a computer
            </Button>
          )}
          <div className="flex gap-2 w-full">
            {outputPath && (
              <Button
                ref={pathFeedback.buttonRef}
                variant="secondary"
                size="sm"
                className="flex-1 gap-2 relative"
                onClick={async () => {
                  await pathFeedback.triggerAsync(
                    () => copyText(outputPath),
                    'Copied',
                    'Copy failed'
                  );
                }}
              >
                <FileText className="h-4 w-4" />
                Copy path
                <InlineFeedbackPopover feedback={pathFeedback.feedback} />
              </Button>
            )}
            <Button variant={onGoToApply ? "secondary" : "primary"} onClick={onClose} className="flex-1">
              {onGoToApply ? 'Close' : 'Done'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
