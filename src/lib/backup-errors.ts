/**
 * Friendly headline / body / CTA mapping for hosted-backup engine errors.
 *
 * The engine's error envelope is precise but speaks the CLI's language — its
 * `remediation` field often suggests `Run `endstate backup ...` and retry`,
 * which is useless inside the GUI. This module maps the well-known codes to
 * GUI-appropriate copy and a contextual CTA action (retry / reauth /
 * manage-billing / dismiss) the caller can wire to its own handlers.
 *
 * Unknown codes fall through to the engine's `message`; the engine's
 * `remediation` is suppressed only when it's CLI-flavoured.
 *
 * Mirrors `src/components/app/auth/auth-errors.ts`.
 */
import type { BackupCommandError } from '@/lib/backup-bridge';

export type FriendlyBackupErrorTone = 'info' | 'warning' | 'error';

export type FriendlyBackupErrorCtaAction =
  | 'retry'
  | 'reauth'
  | 'manage-billing'
  | 'dismiss';

export interface FriendlyBackupErrorCta {
  label: string;
  action: FriendlyBackupErrorCtaAction;
}

export interface FriendlyBackupError {
  headline: string;
  body?: string;
  cta?: FriendlyBackupErrorCta;
  tone: FriendlyBackupErrorTone;
}

const CLI_JARGON_PATTERN = /`endstate /;

const NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  'BACKEND_UNREACHABLE',
  'RATE_LIMITED',
  'BACKEND_ERROR',
  'INTERNAL_ERROR',
]);

export function isNetworkErrorCode(code?: string): boolean {
  return code != null && NETWORK_ERROR_CODES.has(code);
}

export function friendlyBackupError(
  err: BackupCommandError | { code?: string; message: string; remediation?: string },
): FriendlyBackupError {
  switch (err.code) {
    case 'AUTH_REQUIRED':
      return {
        headline: 'Your session expired',
        body: 'Sign in again to continue.',
        cta: { label: 'Sign in', action: 'reauth' },
        tone: 'warning',
      };
    case 'SUBSCRIPTION_REQUIRED':
      return {
        headline: 'Hosted Backup needs an active subscription',
        body: 'Subscribe to push and restore your backups.',
        cta: { label: 'Manage subscription', action: 'manage-billing' },
        tone: 'warning',
      };
    case 'NOT_FOUND':
      return {
        headline: "We couldn't find that backup",
        body: "It may have been deleted. Refresh to see what's still available.",
        cta: { label: 'OK', action: 'dismiss' },
        tone: 'warning',
      };
    case 'PERMISSION_DENIED':
      return {
        headline: "You don't have access to that backup",
        body: 'Sign in with the account that created it.',
        cta: { label: 'Sign in', action: 'reauth' },
        tone: 'error',
      };
    case 'RATE_LIMITED':
      return {
        headline: 'Hosted Backup is busy right now',
        body: 'Wait a moment, then try again.',
        cta: { label: 'Try again', action: 'retry' },
        tone: 'warning',
      };
    case 'BACKEND_ERROR':
      return {
        headline: 'Hosted Backup ran into a problem',
        body: 'Try again in a few moments.',
        cta: { label: 'Try again', action: 'retry' },
        tone: 'error',
      };
    case 'BACKEND_UNREACHABLE':
      return {
        headline: "Can't reach Hosted Backup",
        body: 'Check your internet connection, then try again.',
        cta: { label: 'Try again', action: 'retry' },
        tone: 'error',
      };
    case 'BACKEND_INCOMPATIBLE':
      return {
        headline: "Your app version isn't compatible with Hosted Backup",
        body: 'Update Endstate to the latest version.',
        tone: 'error',
      };
    case 'INTERNAL_ERROR':
      return {
        headline: 'Something went wrong',
        body: 'Try again in a moment.',
        cta: { label: 'Try again', action: 'retry' },
        tone: 'error',
      };
    case 'SCHEMA_INCOMPATIBLE':
      return {
        headline: 'This backup was made with a different app version',
        body: 'Update Endstate to restore it.',
        tone: 'error',
      };
    case 'STORAGE_QUOTA_EXCEEDED':
      return {
        headline: "You've hit your backup storage limit",
        body: 'Delete older versions to free up space.',
        cta: { label: 'OK', action: 'dismiss' },
        tone: 'warning',
      };
    case 'CLAIM_TOKEN_INVALID':
      return {
        headline: "That claim code isn't valid",
        body: 'Double-check the code from your purchase email.',
        tone: 'error',
      };
    case 'CLAIM_TOKEN_EXPIRED':
      return {
        headline: 'This claim link has expired',
        body: 'Email founder@substratesystems.io to request a fresh link.',
        tone: 'error',
      };
    case 'CLAIM_TOKEN_CONSUMED':
      return {
        headline: 'This claim code has already been used',
        tone: 'warning',
      };
    case 'KDF_TOO_WEAK':
      return {
        headline: "That password isn't strong enough",
        body: 'Use at least 12 characters.',
        tone: 'error',
      };
    case 'RESTORE_FAILED':
      return {
        headline: "Restore couldn't complete",
        body: 'Try again — if the problem keeps happening, contact support.',
        cta: { label: 'Try again', action: 'retry' },
        tone: 'error',
      };
    case 'VERIFY_FAILED':
      return {
        headline: 'Backup integrity check failed',
        body: 'The downloaded data may be corrupted. Try restoring again.',
        cta: { label: 'Try again', action: 'retry' },
        tone: 'error',
      };
    default: {
      const cliJargon =
        err.remediation != null && CLI_JARGON_PATTERN.test(err.remediation);
      return {
        headline: err.message || 'Something went wrong',
        body: cliJargon ? undefined : err.remediation,
        tone: 'error',
      };
    }
  }
}
