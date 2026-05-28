/**
 * Relative-time formatting for the backup pane's "Last synced N ago" indicator.
 *
 * Bands are chosen for calm readability — fresh up to 24h, stale 1–7 days,
 * very-stale beyond that (rendered as a locale short date so the user can read
 * the calendar position rather than parse a large "N days ago" number).
 *
 * The utility never throws on garbage input — null / undefined / empty / an
 * unparseable string all collapse to the calm "never" state because a freshly
 * signed-in user with no backups yet isn't in trouble.
 *
 * Future timestamps (negative delta) are clamped to "Just now" rather than
 * surfacing the engine's optimistic / clock-skewed value as an error — not
 * actively wrong, not worth alarming.
 */

export type Freshness = 'fresh' | 'stale' | 'very-stale' | 'never';

export interface FormattedRelativeTime {
  label: string;
  freshness: Freshness;
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/** Format an ISO 8601 timestamp into a calm relative-time label + freshness band. */
export function formatRelativeTime(
  iso: string | null | undefined,
  nowMs?: number,
): FormattedRelativeTime {
  if (iso === null || iso === undefined || iso === '') {
    return { label: 'No backups yet', freshness: 'never' };
  }
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    return { label: 'No backups yet', freshness: 'never' };
  }

  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const delta = now - ts;

  // Future timestamp — clock skew / optimistic engine emit. Clamp to "Just now".
  if (delta < 0) {
    return { label: 'Just now', freshness: 'fresh' };
  }

  if (delta < ONE_MINUTE_MS) {
    return { label: 'Just now', freshness: 'fresh' };
  }

  if (delta < ONE_HOUR_MS) {
    const minutes = Math.floor(delta / ONE_MINUTE_MS);
    // "min" reads cleanly as both singular and plural; keep it short.
    return { label: `${minutes} min ago`, freshness: 'fresh' };
  }

  if (delta < ONE_DAY_MS) {
    const hours = Math.floor(delta / ONE_HOUR_MS);
    return {
      label: `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`,
      freshness: 'fresh',
    };
  }

  if (delta < ONE_WEEK_MS) {
    const days = Math.floor(delta / ONE_DAY_MS);
    return {
      label: `${days} ${days === 1 ? 'day' : 'days'} ago`,
      freshness: 'stale',
    };
  }

  // >= 7 days — render as locale short date (e.g. "May 12" en-US, "12. Mai" de-DE).
  const label = new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return { label: `on ${label}`, freshness: 'very-stale' };
}
