import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface CaptureResultModalProps {
  open: boolean;
  onClose: () => void;
  succeeded: number;
  skipped: number;
  failed: number;
  outputPath: string;
}

export function CaptureResultModal({
  open,
  onClose,
  succeeded,
  skipped,
  failed,
  outputPath,
}: CaptureResultModalProps) {
  const hasIssues = failed > 0;
  const displayPath = outputPath ? outputPath.split('\\').pop() || outputPath : '';

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

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
