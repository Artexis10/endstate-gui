import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { AppIcon } from './app-icon';

interface CaptureResultModalProps {
  open: boolean;
  onClose: () => void;
  appsDetected: number;
  appsIncluded: number;
  appsSkipped: number;
  detectedApps?: Array<{ id: string; name: string }>;
}

export function CaptureResultModal({
  open,
  onClose,
  appsDetected,
  appsIncluded,
  appsSkipped,
  detectedApps = [],
}: CaptureResultModalProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <DialogTitle className="text-2xl">Setup profile created</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            Your computer was scanned and a setup profile was saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm font-medium">Applications detected</span>
            <span className="text-2xl font-semibold text-success">{appsDetected}</span>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/20">
            <span className="text-sm font-medium">Included in setup</span>
            <span className="text-2xl font-semibold">{appsIncluded}</span>
          </div>
          
          {appsSkipped > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-muted/20">
              <span className="text-sm font-medium">Skipped</span>
              <span className="text-2xl font-semibold text-muted-foreground">{appsSkipped}</span>
            </div>
          )}
        </div>

        {detectedApps.length > 0 && (
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
            >
              {showDetails ? 'Hide' : 'View'} details ({detectedApps.length} apps)
            </button>
            
            {showDetails && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detectedApps.map((app, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded bg-accent/5">
                    <AppIcon wingetId={app.id} className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{app.name || app.id}</p>
                    </div>
                  </div>
                ))}
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
