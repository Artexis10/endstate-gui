/**
 * Quota usage indicator for the hosted-backup pane.
 *
 * Renders the user's storage usage as a one-line summary plus a thin progress
 * bar. Tints warn at >=50% and danger at >=90% so the user notices growth
 * before hitting the wall. Renders nothing when `quotaTotalBytes` is unset —
 * the engine surfaces these fields in a coordinated update, and the GUI
 * silently degrades when older engine builds don't include them.
 */

import { formatBytes } from '@/lib/format-bytes';

export interface QuotaMeterProps {
  quotaUsedBytes?: number;
  quotaTotalBytes?: number;
  versionCount?: number;
  /** Max retained versions per the plan. Defaults to 5 (current contract). */
  versionLimit?: number;
}

export function QuotaMeter({
  quotaUsedBytes,
  quotaTotalBytes,
  versionCount,
  versionLimit = 5,
}: QuotaMeterProps) {
  if (!quotaTotalBytes || quotaTotalBytes <= 0) return null;

  const used = Math.max(0, quotaUsedBytes ?? 0);
  const pct = Math.min(100, Math.round((used / quotaTotalBytes) * 100));
  const tone: 'normal' | 'warn' | 'danger' =
    pct >= 90 ? 'danger' : pct >= 50 ? 'warn' : 'normal';

  const barColor =
    tone === 'danger'
      ? 'bg-danger'
      : tone === 'warn'
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <div
      data-testid="quota-meter"
      data-tone={tone}
      className="flex flex-col gap-1.5 rounded-md border border-border bg-card/40 px-4 py-2.5"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Using <span className="text-foreground">{formatBytes(used)}</span>{' '}
          of {formatBytes(quotaTotalBytes)} ({pct}%)
          {typeof versionCount === 'number' && (
            <>
              {' '}
              · {versionCount}/{versionLimit} versions
            </>
          )}
        </span>
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Hosted Backup storage used"
      >
        <div
          className={`h-full ${barColor} transition-[width]`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
