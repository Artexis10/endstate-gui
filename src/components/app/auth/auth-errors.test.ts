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
});
