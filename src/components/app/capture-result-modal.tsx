import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, AlertTriangle, Copy, Package } from 'lucide-react';
import { useState } from 'react';
import { StatusPill } from './status-pill';
import type { AppEntry } from '../../lib/log-parse';

interface CaptureResultModalProps {
  open: boolean;
  onClose: () => void;
  succeeded: number;
  skipped: number;
  failed: number;
  outputPath: string;
  apps: AppEntry[];
}

export function CaptureResultModal({
  open,
  onClose,
  succeeded,
  skipped,
  failed,
  outputPath,
  apps,
}: CaptureResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasIssues = failed > 0;
  const displayPath = outputPath ? outputPath.split('\\').pop() || outputPath : '';

  const capturedApps = apps.filter(a => a.status === 'ok');
  const skippedApps = apps.filter(a => a.status === 'skip');
  const failedApps = apps.filter(a => a.status === 'fail');

  const copyToClipboard = async () => {
    const text = [
      `Captured (${capturedApps.length}):`,
      ...capturedApps.map(a => `  - ${a.id}${a.driver ? ` (${a.driver})` : ''}`),
      skippedApps.length > 0 ? `\nSkipped (${skippedApps.length}):` : '',
      ...skippedApps.map(a => `  - ${a.id}${a.driver ? ` (${a.driver})` : ''}`),
      failedApps.length > 0 ? `\nFailed (${failedApps.length}):` : '',
      ...failedApps.map(a => `  - ${a.id}${a.driver ? ` (${a.driver})` : ''}`),
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {hasIssues ? (
              <AlertTriangle className="h-8 w-8 text-warning" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-success" />
            )}
            <DialogTitle className="text-2xl">Setup profile created</DialogTitle>
          </div>
          {outputPath && (
            <DialogDescription className="text-sm pt-2 font-mono text-muted-foreground">
              Saved to: {displayPath}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm font-medium">Apps captured</span>
            <span className="text-2xl font-semibold text-success">{succeeded}</span>
          </div>
          
          {skipped > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Apps skipped</span>
                <span className="text-xs text-muted-foreground">(see Technical details)</span>
              </div>
              <span className="text-2xl font-semibold text-muted-foreground">{skipped}</span>
            </div>
          )}
          
          {failed > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Apps failed</span>
              <span className="text-2xl font-semibold text-warning">{failed}</span>
            </div>
          )}
        </div>

        {apps.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showDetails ? 'Hide' : 'View'} details ({apps.length} apps)
              </button>
              {showDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-8 gap-2"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Copied!' : 'Copy list'}
                </Button>
              )}
            </div>
            
            {showDetails && (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {capturedApps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">CAPTURED ({capturedApps.length})</p>
                    <div className="space-y-1">
                      {capturedApps.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-success/5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-mono truncate">{app.id}</span>
                          {app.driver && (
                            <span className="text-muted-foreground">{app.driver}</span>
                          )}
                          <StatusPill status="ok" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {skippedApps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">SKIPPED ({skippedApps.length})</p>
                    <div className="space-y-1">
                      {skippedApps.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted/5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-mono truncate">{app.id}</span>
                          {app.driver && (
                            <span className="text-muted-foreground">{app.driver}</span>
                          )}
                          <StatusPill status="neutral" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {failedApps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">FAILED ({failedApps.length})</p>
                    <div className="space-y-1">
                      {failedApps.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-warning/5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-mono truncate">{app.id}</span>
                          {app.driver && (
                            <span className="text-muted-foreground">{app.driver}</span>
                          )}
                          <StatusPill status="error" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
