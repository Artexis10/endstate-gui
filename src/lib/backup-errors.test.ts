import { describe, expect, it } from 'vitest';
import {
  friendlyBackupError,
  isNetworkErrorCode,
  type FriendlyBackupErrorCtaAction,
} from './backup-errors';
import { BackupCommandError } from './backup-bridge';

describe('friendlyBackupError', () => {
  it('maps AUTH_REQUIRED to a session-expired headline + reauth CTA', () => {
    const err = new BackupCommandError({
      code: 'AUTH_REQUIRED',
      message: 'token revoked',
      remediation: 'Run `endstate backup login` and retry.',
    });
    const f = friendlyBackupError(err);
    expect(f.headline).toMatch(/session expired/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('reauth');
    expect(f.tone).toBe('warning');
  });

  it('maps SUBSCRIPTION_REQUIRED to a manage-billing CTA', () => {
    const f = friendlyBackupError({
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'no active subscription',
    });
    expect(f.headline).toMatch(/subscription/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('manage-billing');
    expect(f.tone).toBe('warning');
  });

  it('maps NOT_FOUND to a dismiss CTA with warning tone', () => {
    const f = friendlyBackupError({
      code: 'NOT_FOUND',
      message: 'backup id not found',
    });
    expect(f.headline).toMatch(/couldn't find/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('dismiss');
    expect(f.tone).toBe('warning');
  });

  it('maps PERMISSION_DENIED to a reauth CTA', () => {
    const f = friendlyBackupError({
      code: 'PERMISSION_DENIED',
      message: 'unauthorized',
    });
    expect(f.headline).toMatch(/access/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('reauth');
    expect(f.tone).toBe('error');
  });

  it('maps RATE_LIMITED to a warning-tone retry CTA', () => {
    const f = friendlyBackupError({
      code: 'RATE_LIMITED',
      message: '429 too many requests',
    });
    expect(f.headline).toMatch(/busy/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('retry');
    expect(f.tone).toBe('warning');
  });

  it('maps BACKEND_ERROR to a retry CTA', () => {
    const f = friendlyBackupError({
      code: 'BACKEND_ERROR',
      message: '500 internal server error',
    });
    expect(f.headline).toMatch(/problem/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('retry');
  });

  it('maps BACKEND_UNREACHABLE to a retry CTA with internet-check copy', () => {
    const f = friendlyBackupError({
      code: 'BACKEND_UNREACHABLE',
      message: 'dial tcp: connection refused',
    });
    expect(f.headline).toMatch(/can't reach/i);
    expect(f.body).toMatch(/internet/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('retry');
  });

  it('maps BACKEND_INCOMPATIBLE to an update-app message with no CTA', () => {
    const f = friendlyBackupError({
      code: 'BACKEND_INCOMPATIBLE',
      message: 'protocol version mismatch',
    });
    expect(f.headline).toMatch(/version/i);
    expect(f.body).toMatch(/update/i);
    expect(f.cta).toBeUndefined();
  });

  it('maps INTERNAL_ERROR to a retry CTA', () => {
    const f = friendlyBackupError({
      code: 'INTERNAL_ERROR',
      message: 'context cancelled',
    });
    expect(f.headline).toMatch(/something went wrong/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('retry');
  });

  it('maps SCHEMA_INCOMPATIBLE to an update-app message with no CTA', () => {
    const f = friendlyBackupError({
      code: 'SCHEMA_INCOMPATIBLE',
      message: 'schema v3 not supported',
    });
    expect(f.headline).toMatch(/different app version/i);
    expect(f.cta).toBeUndefined();
  });

  it('maps STORAGE_QUOTA_EXCEEDED to a warning-tone dismiss CTA, never destructive', () => {
    const f = friendlyBackupError({
      code: 'STORAGE_QUOTA_EXCEEDED',
      message: 'quota exceeded',
      remediation: 'Run `endstate backup delete-version` to free space.',
    });
    expect(f.headline).toMatch(/storage limit/i);
    expect(f.body).toMatch(/delete older/i);
    expect(f.tone).toBe('warning');
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('dismiss');
    // CLI-jargon remediation must not leak through
    expect(JSON.stringify(f)).not.toMatch(/`endstate /);
  });

  it('maps CLAIM_TOKEN_INVALID to a helpful body, no CTA', () => {
    const f = friendlyBackupError({
      code: 'CLAIM_TOKEN_INVALID',
      message: 'invalid token',
    });
    expect(f.headline).toMatch(/claim code/i);
    expect(f.body).toMatch(/purchase email/i);
    expect(f.cta).toBeUndefined();
  });

  it('maps CLAIM_TOKEN_EXPIRED to founder@ contact body', () => {
    const f = friendlyBackupError({
      code: 'CLAIM_TOKEN_EXPIRED',
      message: 'token expired',
    });
    expect(f.headline).toMatch(/expired/i);
    expect(f.body).toMatch(/founder@substratesystems\.io/);
  });

  it('maps CLAIM_TOKEN_CONSUMED to a warning-tone notice', () => {
    const f = friendlyBackupError({
      code: 'CLAIM_TOKEN_CONSUMED',
      message: 'consumed',
    });
    expect(f.headline).toMatch(/already been used/i);
    expect(f.tone).toBe('warning');
  });

  it('maps KDF_TOO_WEAK to password-strength body', () => {
    const f = friendlyBackupError({
      code: 'KDF_TOO_WEAK',
      message: 'argon2id parameters reject',
    });
    expect(f.headline).toMatch(/password/i);
    expect(f.body).toMatch(/12 characters/i);
  });

  it('maps RESTORE_FAILED to a retry CTA', () => {
    const f = friendlyBackupError({
      code: 'RESTORE_FAILED',
      message: 'apply failed: file in use',
    });
    expect(f.headline).toMatch(/restore/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('retry');
  });

  it('maps VERIFY_FAILED to a retry CTA with integrity copy', () => {
    const f = friendlyBackupError({
      code: 'VERIFY_FAILED',
      message: 'sha256 mismatch',
    });
    expect(f.headline).toMatch(/integrity/i);
    expect(f.cta?.action).toBe<FriendlyBackupErrorCtaAction>('retry');
  });

  it('falls back to the engine message for unknown codes, stripping CLI jargon', () => {
    const f = friendlyBackupError({
      code: 'WEIRD_NEW_CODE',
      message: 'something strange',
      remediation: 'Run `endstate backup push --profile foo` to retry.',
    });
    expect(f.headline).toBe('something strange');
    expect(f.body).toBeUndefined();
    expect(f.cta).toBeUndefined();
    expect(f.tone).toBe('error');
  });

  it('preserves non-CLI remediation on unknown codes', () => {
    const f = friendlyBackupError({
      code: 'WEIRD_NEW_CODE',
      message: 'oops',
      remediation: 'Please try again later.',
    });
    expect(f.body).toBe('Please try again later.');
  });

  it('handles missing message gracefully on unknown codes', () => {
    const f = friendlyBackupError({
      code: 'WEIRD_NEW_CODE',
      message: '',
    });
    expect(f.headline).toBe('Something went wrong');
    expect(f.tone).toBe('error');
  });

  it('handles missing code (undefined) via fallback path', () => {
    const f = friendlyBackupError({ message: 'engine failure' });
    expect(f.headline).toBe('engine failure');
    expect(f.cta).toBeUndefined();
  });
});

describe('isNetworkErrorCode', () => {
  it('returns true for network/transient codes', () => {
    expect(isNetworkErrorCode('BACKEND_UNREACHABLE')).toBe(true);
    expect(isNetworkErrorCode('RATE_LIMITED')).toBe(true);
    expect(isNetworkErrorCode('BACKEND_ERROR')).toBe(true);
    expect(isNetworkErrorCode('INTERNAL_ERROR')).toBe(true);
  });

  it('returns false for non-network codes', () => {
    expect(isNetworkErrorCode('AUTH_REQUIRED')).toBe(false);
    expect(isNetworkErrorCode('STORAGE_QUOTA_EXCEEDED')).toBe(false);
    expect(isNetworkErrorCode('NOT_FOUND')).toBe(false);
  });

  it('returns false for undefined / unknown codes', () => {
    expect(isNetworkErrorCode(undefined)).toBe(false);
    expect(isNetworkErrorCode('SOMETHING_ELSE')).toBe(false);
  });
});
