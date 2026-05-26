/**
 * Format a byte count into a short human-readable string.
 *
 * Uses binary (1024) units throughout so the result lines up with engine /
 * substrate reporting (chunk sizes, quota math) which also count in binary.
 * Returns "0 B" for non-finite or negative inputs rather than NaN/-X B —
 * the GUI never wants to render gibberish from a missing/garbage value.
 */
export function formatBytes(bytes: number | undefined | null): string {
  if (!Number.isFinite(bytes ?? NaN) || (bytes ?? -1) < 0) return '0 B';
  const n = bytes as number;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
