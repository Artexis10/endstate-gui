import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusPill } from './status-pill';
import { CheckCircle2, AlertCircle, Copy, Package } from 'lucide-react';

interface ScanResult {
  type: string;
  status: string;
  id?: string;
  ref?: string;
  message?: string;
}

interface ScanResultModalProps {
  open: boolean;
  onClose: () => void;
  okCount: number;
  missingCount: number;
  mismatchCount: number;
  results?: ScanResult[];
  onFixApps: () => void;
}

export function ScanResultModal({
  open,
  onClose,
  okCount,
  missingCount,
  mismatchCount,
  results = [],
  onFixApps,
}: ScanResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasIssues = missingCount > 0 || mismatchCount > 0;
  
  const okApps = results.filter(r => r.status === 'ok' || r.status === 'pass');
  const missingApps = results.filter(r => r.status === 'missing');
  const mismatchApps = results.filter(r => r.status === 'version-mismatch' || r.status === 'fail');
  
  const copyToClipboard = async () => {
    const text = [
      okApps.length > 0 ? `Up to date (${okApps.length}):` : '',
      ...okApps.map(a => `  - ${a.id || a.ref}`),
      missingApps.length > 0 ? `\nMissing (${missingApps.length}):` : '',
      ...missingApps.map(a => `  - ${a.id || a.ref}`),
      mismatchApps.length > 0 ? `\nVersion mismatch (${mismatchApps.length}):` : '',
      ...mismatchApps.map(a => `  - ${a.id || a.ref}`),
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
              <AlertCircle className="h-8 w-8 text-warning" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-success" />
            )}
            <DialogTitle className="text-2xl">
              {hasIssues ? "We found a few things to fix" : "Your computer is ready"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {hasIssues
              ? "Some applications need to be installed or updated."
              : "Everything matches your setup."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm font-medium">Up to date</span>
            <span className="text-2xl font-semibold text-success">{okCount}</span>
          </div>
          
          {missingCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Missing</span>
              <span className="text-2xl font-semibold text-warning">{missingCount}</span>
            </div>
          )}
          
          {mismatchCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Version mismatch</span>
              <span className="text-2xl font-semibold text-warning">{mismatchCount}</span>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showDetails ? 'Hide' : 'View'} details ({results.length} apps)
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
                {okApps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">UP TO DATE ({okApps.length})</p>
                    <div className="space-y-1">
                      {okApps.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-success/5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-mono truncate">{app.id || app.ref}</span>
                          <StatusPill status="ok" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {missingApps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">MISSING ({missingApps.length})</p>
                    <div className="space-y-1">
                      {missingApps.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-warning/5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-mono truncate">{app.id || app.ref}</span>
                          <StatusPill status="missing" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {mismatchApps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">VERSION MISMATCH ({mismatchApps.length})</p>
                    <div className="space-y-1">
                      {mismatchApps.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded bg-warning/5 text-xs">
                          <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-mono truncate">{app.id || app.ref}</span>
                          {app.message && (
                            <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{app.message}</span>
                          )}
                          <StatusPill status="mismatch" />
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
          {hasIssues ? (
            <Button onClick={onFixApps} className="w-full">
              Install missing apps
            </Button>
          ) : (
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
