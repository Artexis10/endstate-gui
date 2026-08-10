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

import { getCurrentNamespace, getItem, setItem } from './storage';

const KEY_PREFIX = 'first-push-done:';

function keyFor(email: string): string {
  // Lowercase for case-insensitive lookup; emails are case-insensitive per RFC 5321.
  return `${KEY_PREFIX}${email.trim().toLowerCase()}`;
}

export function hasSeenFirstPushFor(email: string | undefined | null): boolean {
  if (!email) return true; // No email = no celebration (can't key it)
  return getItem(keyFor(email)) === '1';
}

/**
 * Whether this local installation has completed any durable cloud push.
 * Unlike the per-email toast check, this is intentionally account-agnostic:
 * it is conservative evidence that Endstate Cloud has already been used here.
 */
export function hasRecordedFirstPush(): boolean {
  try {
    const prefix = `${getCurrentNamespace()}:${KEY_PREFIX}`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix) && localStorage.getItem(key) === '1') return true;
    }
    return false;
  } catch {
    // Privacy mode or a denied storage backend makes prior use unknowable.
    // Suppress the invitation rather than crashing the otherwise local app or
    // re-offering a paid-service prompt to a possibly prior managed account.
    return true;
  }
}

export function markFirstPushFor(email: string | undefined | null): void {
  if (!email) return;
  setItem(keyFor(email), '1');
}
