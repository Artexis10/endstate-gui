import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClaimSessionCheckDialogProps {
  open: boolean;
  busy: boolean;
  onRetry: () => void;
}

export function ClaimSessionCheckDialog({
  open,
  busy,
  onRetry,
}: ClaimSessionCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>Check your account session</DialogTitle>
          <DialogDescription>
            Endstate could not verify whether an account is already signed in.
            Retry the session check to continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" disabled={busy} onClick={onRetry}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking session
              </>
            ) : (
              'Retry session check'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
