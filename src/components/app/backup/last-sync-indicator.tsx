/**
 * Backup-pane "last synced" freshness row.
 *
 * Renders a single muted-text row below the QuotaMeter using
 * `formatRelativeTime` to compute both the label and the freshness band.
 *
 * Tints by band:
 *   - `fresh` (< 24h)           → `text-muted-foreground` (calm)
 *   - `stale` (24h–7d)          → `text-warning/80`
 *   - `very-stale` (>= 7d)      → `text-danger/80`
 *   - `never` (missing/garbage) → `text-muted-foreground` (calm — a brand-new
 *                                  signed-in user without backups isn't in trouble)
 *
 * Deliberately NOT a live region (no `role`, no `aria-live`): the indicator
 * updates on every focus refresh and would be screen-reader-chatty as a live
 * region. The information is on-screen for sighted users; a screen-reader user
 * will pick it up on the next pane traversal.
 */

import { formatRelativeTime, type Freshness } from '@/lib/format-relative-time';
import { Button } from '@/components/ui/button';

export interface LastSyncIndicatorProps {
  /** ISO 8601 timestamp from `BackupStatusData.lastBackupAt`. */
  lastBackupAt?: string;
  /** Test seam — frozen "now" in ms. Defaults to `Date.now()` inside `formatRelativeTime`. */
  nowMs?: number;
  /**
   * Auto-backup is paused after a background push returned `AUTH_REQUIRED`.
   * Replaces the freshness label with a persistent, actionable
   * "Sign in to resume backups" affordance until the session is restored.
   */
  authPaused?: boolean;
  /** Opens the inline re-auth dialog (per "Session re-auth preserves pane state"). */
  onResumeClick?: () => void;
}

const TINT_BY_FRESHNESS: Record<Freshness, string> = {
  fresh: 'text-muted-foreground',
  stale: 'text-warning/80',
  'very-stale': 'text-danger/80',
  never: 'text-muted-foreground',
};

export function LastSyncIndicator({
  lastBackupAt,
  nowMs,
  authPaused,
  onResumeClick,
}: LastSyncIndicatorProps) {
  // Paused takes precedence over freshness: a dead session is the urgent signal.
  if (authPaused) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onResumeClick}
        data-testid="last-sync-indicator"
        data-paused="true"
        className="h-auto justify-start p-0 text-xs font-normal text-warning/90 hover:bg-transparent hover:text-warning"
      >
        Sign in to resume backups
      </Button>
    );
  }

  const { label, freshness } = formatRelativeTime(lastBackupAt, nowMs);
  const text = freshness === 'never' ? 'No backups yet' : `Last synced ${label}`;

  return (
    <p
      data-testid="last-sync-indicator"
      data-freshness={freshness}
      className={`text-xs ${TINT_BY_FRESHNESS[freshness]}`}
    >
      {text}
    </p>
  );
}
