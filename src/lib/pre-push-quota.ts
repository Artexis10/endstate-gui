/**
 * Pre-push quota gating.
 *
 * Decides whether a manual hosted-backup push should be interrupted with a
 * soft confirmation, given the engine's pre-push size estimate
 * (`backup estimate`) and the user's quota (`backup status`). We warn only when
 * the push would land usage in the top 10% of quota — or over it — so a
 * comfortably-sized push proceeds with no friction. When quota is unknown
 * (older substrate / signed-out) we never warn.
 */

/** Warn once projected usage would exceed this fraction of total quota. */
const WARN_FRACTION = 0.9;

export interface PrePushQuotaAssessment {
  /** 'warn' → show the soft confirm dialog; 'ok' → push immediately. */
  level: 'ok' | 'warn';
  /** True when this single push alone would overflow the quota. */
  exceeds: boolean;
  /** Bytes free before this push (omitted when quota is unknown). */
  remainingBytes?: number;
  /** Whole pushes of this size that still fit in the remaining quota. */
  pushesLeft?: number;
}

export function assessPrePushQuota(
  estimatedUploadBytes: number,
  quotaUsedBytes?: number,
  quotaTotalBytes?: number,
): PrePushQuotaAssessment {
  // Quota unknown (older substrate, or fields absent) → never gate a push.
  if (!quotaTotalBytes || quotaTotalBytes <= 0) {
    return { level: 'ok', exceeds: false };
  }

  const used = Math.max(0, quotaUsedBytes ?? 0);
  const remaining = Math.max(0, quotaTotalBytes - used);
  const est = Math.max(0, estimatedUploadBytes);
  const projected = used + est;

  const exceeds = projected > quotaTotalBytes;
  const warn = projected > WARN_FRACTION * quotaTotalBytes;
  const pushesLeft = est > 0 ? Math.floor(remaining / est) : undefined;

  return {
    level: warn ? 'warn' : 'ok',
    exceeds,
    remainingBytes: remaining,
    pushesLeft,
  };
}
