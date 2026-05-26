/**
 * Pull / restore progress dialog.
 *
 * Pull has three sub-phases per chunk:
 *   `downloading` → `verified` (sha256 match) → `decrypted`
 *
 * Each chunk advances through these states; the dialog shows the dominant
 * sub-phase and overall percent complete (counting only `decrypted` toward
 * progress, since that's the terminal "this chunk is done" state).
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

export type PullSubPhase = 'downloading' | 'verifying' | 'decrypting' | 'idle';

export interface PullRetryState {
  chunkIndex: number;
  /** 1-based attempt number; may be undefined when the engine emits a
   *  retry event without the optional attempt metadata. */
  attempt?: number;
  maxAttempts?: number;
}

export interface PullProgressDialogProps {
  open: boolean;
  totalChunks: number;
  decryptedChunks: number;
  verifiedChunks: number;
  downloadedChunks: number;
  subPhase: PullSubPhase;
  currentChunkIndex: number | null;
  /** Pull doesn't retry today, but the dialog accepts the prop so a future
   *  engine retry on the download path renders without further GUI work. */
  retryState?: PullRetryState | null;
}

const SUB_PHASE_LABEL: Record<PullSubPhase, string> = {
  downloading: 'Downloading',
  verifying: 'Verifying',
  decrypting: 'Decrypting',
  idle: 'Preparing',
};

export function PullProgressDialog({
  open,
  totalChunks,
  decryptedChunks,
  verifiedChunks,
  downloadedChunks,
  subPhase,
  currentChunkIndex,
  retryState,
}: PullProgressDialogProps) {
  const { showToast } = useToast();

  const percent =
    totalChunks > 0 ? Math.min(100, Math.round((decryptedChunks / totalChunks) * 100)) : 0;
  const retryLabel = retryState
    ? retryState.attempt != null && retryState.maxAttempts != null
      ? `Retrying chunk ${retryState.chunkIndex + 1}${
          totalChunks > 0 ? ` of ${totalChunks}` : ''
        } (attempt ${retryState.attempt} of ${retryState.maxAttempts})`
      : 'Retrying…'
    : null;

  const handleCancel = async () => {
    try {
      await invoke('engine_cancel');
      showToast('Restore cancelled.', 'info');
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
          <DialogTitle>Restoring backup</DialogTitle>
          <DialogDescription>
            Downloading, verifying, and decrypting chunks. This window stays open until
            the restore finishes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <div className="flex-1 text-sm">
            {totalChunks === 0 ? (
              <span>Preparing chunks…</span>
            ) : (
              <span>
                {SUB_PHASE_LABEL[subPhase]} chunk{' '}
                {currentChunkIndex !== null ? currentChunkIndex + 1 : decryptedChunks} of{' '}
                {totalChunks}
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
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        {retryLabel && (
          <div
            className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-700"
            data-testid="pull-retry-tag"
            role="status"
            aria-live="polite"
          >
            {retryLabel}
          </div>
        )}
        <dl
          className="grid grid-cols-3 gap-2 text-xs text-muted-foreground"
          data-testid="pull-progress-stats"
        >
          <SubPhaseStat label="Downloaded" count={downloadedChunks} total={totalChunks} />
          <SubPhaseStat label="Verified" count={verifiedChunks} total={totalChunks} />
          <SubPhaseStat label="Decrypted" count={decryptedChunks} total={totalChunks} />
        </dl>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubPhaseStat({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border p-2">
      <dt className="text-[10px] uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">
        {count}
        {total > 0 ? <span className="text-muted-foreground"> / {total}</span> : null}
      </dd>
    </div>
  );
}
