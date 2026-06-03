/**
 * Soft pre-push quota warning.
 *
 * Shown only when the engine's `backup estimate` says a push would land usage
 * in the top 10% of quota (or over it). A comfortably-sized push never sees
 * this — it uploads immediately. Confirm proceeds with the push; Cancel aborts.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format-bytes';

export interface PrePushSizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Estimated bytes this push would upload (encrypted). */
  estimatedUploadBytes: number;
  /** Bytes free before this push. */
  remainingBytes?: number;
  /** Total quota. */
  quotaTotalBytes?: number;
  /** Whole pushes of this size that still fit. */
  pushesLeft?: number;
  /** True when this push alone would overflow the quota. */
  exceeds: boolean;
  /** Proceed with the push. */
  onConfirm: () => void;
}

export function PrePushSizeDialog({
  open,
  onOpenChange,
  estimatedUploadBytes,
  remainingBytes,
  quotaTotalBytes,
  pushesLeft,
  exceeds,
  onConfirm,
}: PrePushSizeDialogProps) {
  const title = exceeds
    ? "This backup won't fit your storage quota"
    : 'Your backup storage is almost full';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This backup is about <strong>{formatBytes(estimatedUploadBytes)}</strong>
            {quotaTotalBytes ? (
              <>
                {' '}— you have {formatBytes(remainingBytes)} of{' '}
                {formatBytes(quotaTotalBytes)} left
                {!exceeds && pushesLeft != null
                  ? ` (about ${pushesLeft} more ${pushesLeft === 1 ? 'push' : 'pushes'} this size)`
                  : ''}
                .
              </>
            ) : (
              '.'
            )}
            {exceeds
              ? ' Pushing it now would exceed your quota and fail — free up space or remove old versions first.'
              : ' You can still push, but you’re running low.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={exceeds ? 'danger' : 'primary'}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {exceeds ? 'Push anyway' : 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
