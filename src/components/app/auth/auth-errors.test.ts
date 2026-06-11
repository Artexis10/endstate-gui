import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './auth-errors';
import { BackupCommandError } from '@/lib/backup-bridge';

describe('friendlyAuthError', () => {
  it('maps NOT_FOUND to a recognizable headline + create-account CTA', () => {
    const err = new BackupCommandError({
      code: 'NOT_FOUND',
      message: 'no account for this email',
    });
    const f = friendlyAuthError(err);
    expect(f.message).toMatch(/recognize/i);
    expect(f.cta).toEqual({ label: 'Create an account', tab: 'sign-up' });
  });

  it('maps AUTH_REQUIRED to friendly copy + reset CTA, and drops CLI-style remediation', () => {
    const err = new BackupCommandError({
      code: 'AUTH_REQUIRED',
      message: 'email or password is incorrect',
      remediation: 'Run `endstate backup login` and retry.',
    });
    const f = friendlyAuthError(err);
    expect(f.message).toMatch(/doesn't match/i);
    expect(f.remediation).not.toMatch(/`endstate /);
    expect(f.cta).toEqual({ label: 'Reset password', tab: 'recover' });
  });

  it('maps EMAIL_EXISTS / ALREADY_EXISTS to "sign in instead"', () => {
    const f = friendlyAuthError({
      code: 'EMAIL_EXISTS',
      message: 'already registered',
    });
    expect(f.message).toMatch(/already exists/i);
    expect(f.cta?.tab).toBe('sign-in');
  });

  it('passes through unknown codes but strips CLI-jargon remediation', () => {
    const f = friendlyAuthError({
      code: 'WEIRD',
      message: 'something happened',
      remediation: 'Run `endstate backup login` again.',
    });
    expect(f.message).toBe('something happened');
    expect(f.remediation).toBeUndefined();
    expect(f.cta).toBeUndefined();
  });

  it('preserves non-CLI remediation on unknown codes', () => {
    const f = friendlyAuthError({
      code: 'WEIRD',
      message: 'oops',
      remediation: 'Please try again later.',
    });
    expect(f.remediation).toBe('Please try again later.');
  });

  it('maps RATE_LIMITED to wait-and-retry copy, no CTA', () => {
    const f = friendlyAuthError(
      new BackupCommandError({
        code: 'RATE_LIMITED',
        message: 'too many attempts; retry after 15 minutes',
      }),
    );
    expect(f.message).toMatch(/too many attempts/i);
    expect(f.remediation).toMatch(/wait/i);
    expect(f.cta).toBeUndefined();
  });

  it('maps CLAIM_TOKEN_INVALID to a friendly headline + helpful remediation, no CTA', () => {
    const f = friendlyAuthError(
      new BackupCommandError({
        code: 'CLAIM_TOKEN_INVALID',
        message: 'token not recognised',
        remediation: 'Run `endstate backup claim` with a valid token.',
      }),
    );
    expect(f.message).toMatch(/doesn't match/i);
    expect(f.remediation).toMatch(/purchase email/i);
    expect(f.remediation).not.toMatch(/`endstate /);
    expect(f.cta).toBeUndefined();
  });

  it('maps CLAIM_TOKEN_EXPIRED to founder@ remediation with no CTA', () => {
    const f = friendlyAuthError({
      code: 'CLAIM_TOKEN_EXPIRED',
      message: 'token expired',
    });
    expect(f.message).toMatch(/expired/i);
    expect(f.remediation).toMatch(/founder@substratesystems\.io/);
    expect(f.cta).toBeUndefined();
  });

  it('maps CLAIM_TOKEN_CONSUMED to a sign-in CTA', () => {
    const f = friendlyAuthError({
      code: 'CLAIM_TOKEN_CONSUMED',
      message: 'already consumed',
    });
    expect(f.message).toMatch(/already been used/i);
    expect(f.cta).toEqual({ label: 'Sign in', tab: 'sign-in' });
  });

  it('maps KDF_TOO_WEAK to a password-strength remediation', () => {
    const f = friendlyAuthError({
      code: 'KDF_TOO_WEAK',
      message: 'argon2id parameters reject',
    });
    expect(f.message).toMatch(/password/i);
    expect(f.remediation).toMatch(/12 characters/i);
    expect(f.cta).toBeUndefined();
  });
});
