/**
 * Shared quota-tone bands for the hosted-backup pane.
 *
 * Single source of truth consumed by both `QuotaMeter` (the progress bar) and
 * `QuotaNotice` (the persistent warn/danger banner) so the 50%/90% threshold
 * bands cannot drift between them. Callers MUST guard against
 * `totalBytes <= 0` themselves — the function throws so a forgotten guard
 * surfaces immediately instead of silently rendering nonsense.
 */

export type QuotaTone = 'normal' | 'warn' | 'danger';

export interface QuotaToneResult {
  /** Percent used, rounded to nearest integer, clamped to [0, 100]. */
  pct: number;
  tone: QuotaTone;
}

/**
 * Compute the rounded usage percent and the tone band for a quota pair.
 *
 * @param usedBytes Bytes currently consumed. Negative values are clamped to 0.
 * @param totalBytes Total quota size. MUST be `> 0`; callers should skip
 *   rendering entirely (or short-circuit) when the engine has not yet
 *   reported a total.
 * @throws RangeError when `totalBytes <= 0`.
 */
export function quotaTone(usedBytes: number, totalBytes: number): QuotaToneResult {
  if (!(totalBytes > 0)) {
    throw new RangeError(
      `quotaTone: totalBytes must be > 0, received ${totalBytes}`,
    );
  }
  const used = Math.max(0, usedBytes);
  const pct = Math.min(100, Math.round((used / totalBytes) * 100));
  const tone: QuotaTone = pct >= 90 ? 'danger' : pct >= 50 ? 'warn' : 'normal';
  return { pct, tone };
}
