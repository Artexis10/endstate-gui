/**
 * Persistent quota-near-limit notice for the hosted-backup pane.
 *
 * Renders above the QuotaMeter as a tinted banner at >=50% (warn) and >=90%
 * (danger) usage. Replaces the once-per-account 90% toast (retired) with a
 * persistent surface so a dismissed cue can't strand the user. Hidden when
 * the engine has not yet reported `quotaTotalBytes` (older engine builds).
 *
 * Threshold logic delegates to `quotaTone` so the bands cannot drift from
 * QuotaMeter. No CTA — the SubscriptionBanner above already exposes Manage;
 * a second button on the same column is noise.
 *
 * Visual shell mirrors `subscription-banner.tsx` BannerShell inline rather
 * than extracting it — extraction would be a drive-by refactor on an
 * unrelated file.
 */

import { AlertTriangle, OctagonX } from 'lucide-react';
import { formatBytes } from '@/lib/format-bytes';
import { quotaTone } from '@/lib/quota-tone';

export interface QuotaNoticeProps {
  quotaUsedBytes?: number;
  quotaTotalBytes?: number;
}

export function QuotaNotice({
  quotaUsedBytes,
  quotaTotalBytes,
}: QuotaNoticeProps) {
  if (!quotaTotalBytes || quotaTotalBytes <= 0) return null;

  const used = Math.max(0, quotaUsedBytes ?? 0);
  const { pct, tone } = quotaTone(used, quotaTotalBytes);

  if (tone === 'normal') return null;

  const usedLabel = formatBytes(used);
  const totalLabel = formatBytes(quotaTotalBytes);

  const isDanger = tone === 'danger';
  const icon = isDanger ? (
    <OctagonX className="h-5 w-5" />
  ) : (
    <AlertTriangle className="h-5 w-5" />
  );
  const title = isDanger
    ? 'Backup storage almost full'
    : 'Backup storage filling up';
  const description = isDanger
    ? `Backup storage almost full (${pct}%) — using ${usedLabel} of ${totalLabel}. Delete versions or upgrade to keep backing up.`
    : `Backup storage at ${pct}% — using ${usedLabel} of ${totalLabel}. Delete older versions to free space.`;

  const toneClass = isDanger
    ? 'border-danger/30 bg-danger/10'
    : 'border-warning/30 bg-warning/10';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="quota-notice"
      data-tone={tone}
      className={`flex items-center justify-between gap-4 rounded-md border ${toneClass} p-4`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
