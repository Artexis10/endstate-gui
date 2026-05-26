/**
 * Per-account "first hosted-backup push completed" flag.
 *
 * Keyed by email rather than user_id so the flag survives an engine session
 * being replaced (re-login, claim → sign-in transition, recovery). The
 * celebration toast only ever fires once per account on a given machine; if a
 * user clears localStorage or moves to a new machine they'll see it again,
 * which is the right behavior — first-push on a *new* machine is also worth
 * celebrating.
 *
 * Storage is namespace-prefixed via `lib/storage.ts` (tauri / web / test) so
 * Playwright runs don't leak the flag across test users.
 */

import { getItem, setItem } from './storage';

const KEY_PREFIX = 'first-push-done:';

function keyFor(email: string): string {
  // Lowercase for case-insensitive lookup; emails are case-insensitive per RFC 5321.
  return `${KEY_PREFIX}${email.trim().toLowerCase()}`;
}

export function hasSeenFirstPushFor(email: string | undefined | null): boolean {
  if (!email) return true; // No email = no celebration (can't key it)
  return getItem(keyFor(email)) === '1';
}

export function markFirstPushFor(email: string | undefined | null): void {
  if (!email) return;
  setItem(keyFor(email), '1');
}
