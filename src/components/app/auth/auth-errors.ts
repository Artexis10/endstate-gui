/**
 * Friendly headline / remediation / CTA mapping for hosted-backup auth errors.
 *
 * The engine's error envelope is precise but speaks the CLI's language — its
 * `remediation` field often suggests "Run `endstate backup login` and retry",
 * which is useless inside the GUI. This module maps the well-known codes to
 * GUI-appropriate copy and offers a contextual switch-tab CTA where there's
 * an obvious next step (NOT_FOUND → create account, AUTH_REQUIRED → reset).
 *
 * Unknown codes fall through to the engine's `message`; the engine's
 * `remediation` is suppressed only when it's CLI-flavoured.
 */
import type { BackupCommandError } from '@/lib/backup-bridge';

export type AuthErrorCta = {
  label: string;
  tab: 'sign-in' | 'sign-up' | 'recover';
};

export interface FriendlyAuthError {
  message: string;
  remediation?: string;
  cta?: AuthErrorCta;
}

const CLI_JARGON_PATTERN = /`endstate /;

export function friendlyAuthError(
  err: BackupCommandError | { code?: string; message: string; remediation?: string },
): FriendlyAuthError {
  switch (err.code) {
    case 'NOT_FOUND':
      return {
        message: "We don't recognize that email.",
        remediation: 'Double-check it, or create a new account.',
        cta: { label: 'Create an account', tab: 'sign-up' },
      };
    case 'AUTH_REQUIRED':
      return {
        message: "Email or password doesn't match.",
        remediation: 'Try again — or reset your password if you forgot it.',
        cta: { label: 'Reset password', tab: 'recover' },
      };
    case 'EMAIL_EXISTS':
    case 'ALREADY_EXISTS':
      return {
        message: 'An account with this email already exists.',
        remediation: 'Sign in instead, or use a different email.',
        cta: { label: 'Sign in', tab: 'sign-in' },
      };
    case 'INVALID_RECOVERY_KEY':
    case 'RECOVERY_FAILED':
      return {
        message: "That recovery key doesn't match.",
        remediation:
          'Check for typos. The 24 words must be from the BIP39 list, in order.',
      };
    default: {
      const cliJargon =
        err.remediation && CLI_JARGON_PATTERN.test(err.remediation);
      return {
        message: err.message,
        remediation: cliJargon ? undefined : err.remediation,
      };
    }
  }
}
