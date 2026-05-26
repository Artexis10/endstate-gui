/**
 * Per-account "quota approaching cap" warning seen flag.
 *
 * Keyed by email so the warning fires once per account per machine — same
 * pattern as `first-push-flag`. We can't avoid the toast indefinitely (the
 * user might dismiss it, then add a new device that needs to warn again),
 * but spamming the warning on every focus refresh is worse than not warning
 * at all.
 *
 * The flag is reset whenever the user drops back below the threshold — the
 * `clearQuotaWarningFor` call from the BackupPane effect is what makes the
 * warning re-arm after the user deletes versions. Without that, deleting +
 * filling back up wouldn't re-warn.
 */

import { getItem, setItem, removeItem } from './storage';

const KEY_PREFIX = 'quota-warning-shown:';

function keyFor(email: string): string {
  return `${KEY_PREFIX}${email.trim().toLowerCase()}`;
}

export function hasSeenQuotaWarningFor(email: string | undefined | null): boolean {
  if (!email) return true; // no email → can't key, treat as seen so we don't toast
  return getItem(keyFor(email)) === '1';
}

export function markQuotaWarningFor(email: string | undefined | null): void {
  if (!email) return;
  setItem(keyFor(email), '1');
}

/** Reset the flag so the warning re-fires if the user climbs back over the
 *  threshold later. Called when status reports the user is below the
 *  threshold again (e.g. after deleting old versions). */
export function clearQuotaWarningFor(email: string | undefined | null): void {
  if (!email) return;
  removeItem(keyFor(email));
}
