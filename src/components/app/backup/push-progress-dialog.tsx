/**
 * Push progress dialog.
 *
 * Subscribes to `backup-chunk` streaming events while `endstate backup push`
 * is running. Renders chunks-uploaded / total and the current verb. Includes
 * a Cancel button wired to the existing `engine_cancel` Tauri command per
 * the design decision in `openspec/changes/add-hosted-backup-gui/design.md`.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { invoke } from '@/lib/tauri-bridge';
import { useToast } from '@/components/ui/toast';

export interface PushProgressDialogProps {
  open: boolean;
  /** Total chunks (0 until first event arrives). */
  totalChunks: number;
  /** Number of chunks with status `uploaded`. */
  uploadedChunks: number;
  /** Latest in-progress chunk index, if any. */
  currentChunkIndex: number | null;
}

export function PushProgressDialog({
  open,
  totalChunks,
  uploadedChunks,
  currentChunkIndex,
}: PushProgressDialogProps) {
  const { showToast } = useToast();

  const percent =
    totalChunks > 0 ? Math.min(100, Math.round((uploadedChunks / totalChunks) * 100)) : 0;

  const handleCancel = async () => {
    try {
      await invoke('engine_cancel');
      showToast('Push cancelled. Partial upload will be cleared automatically.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? `Cancel failed: ${err.message}` : 'Cancel failed',
        'warning',
      );
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Uploading backup</DialogTitle>
          <DialogDescription>
            Encrypting and uploading the profile to your backup. This window stays open
            until the upload finishes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <div className="flex-1 text-sm">
            {totalChunks === 0 ? (
              <span>Preparing chunks…</span>
            ) : (
              <span>
                Uploading chunk {currentChunkIndex !== null ? currentChunkIndex + 1 : uploadedChunks}{' '}
                of {totalChunks}
              </span>
            )}
          </div>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground" data-testid="push-progress-text">
          {uploadedChunks} of {totalChunks || '?'} chunks uploaded ({percent}%).
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
