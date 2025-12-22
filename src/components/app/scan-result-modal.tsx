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
import { AppIcon } from './app-icon';
import { StatusPill } from './status-pill';
import { CheckCircle2, AlertCircle } from 'lucide-react';

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
  const hasIssues = missingCount > 0 || mismatchCount > 0;
  const actionableResults = results.filter(
    r => r.status === 'missing' || r.status === 'version-mismatch' || r.status === 'fail'
  );

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
              : "All applications are installed and up to date."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm font-medium">Installed & up to date</span>
            <span className="text-2xl font-semibold text-success">{okCount}</span>
          </div>
          
          {missingCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Missing applications</span>
              <span className="text-2xl font-semibold text-warning">{missingCount}</span>
            </div>
          )}
          
          {mismatchCount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/20">
              <span className="text-sm font-medium">Version mismatches</span>
              <span className="text-2xl font-semibold text-warning">{mismatchCount}</span>
            </div>
          )}
        </div>

        {actionableResults.length > 0 && (
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
            >
              {showDetails ? 'Hide' : 'View'} details ({actionableResults.length} items)
            </button>
            
            {showDetails && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {actionableResults.map((result, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded bg-accent/5">
                    <AppIcon wingetId={result.id || result.ref || ''} className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.id || result.ref || 'Unknown'}</p>
                      {result.message && (
                        <p className="text-xs text-muted-foreground truncate">{result.message}</p>
                      )}
                    </div>
                    <StatusPill 
                      status={
                        result.status === 'missing' ? 'missing' : 
                        result.status === 'version-mismatch' || result.status === 'fail' ? 'mismatch' : 
                        'neutral'
                      } 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={onClose}>
            {hasIssues ? 'Later' : 'Close'}
          </Button>
          {hasIssues ? (
            <Button onClick={onFixApps}>
              Install missing apps
            </Button>
          ) : (
            <Button onClick={onClose}>
              All set
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
