import { describe, expect, it } from 'vitest';
import {
  INITIAL_AUTH_SESSION_TRUTH,
  authRequired,
  authSucceeded,
  claimSessionSignedIn,
  hostedBackupSessionView,
  markBackupStatusSignedOut,
  reconcileAuthStatus,
  sessionSignedOut,
  shouldShowSessionCheckModal,
} from './auth-session-truth';
import type { BackupStatusData } from '@/types';

const SIGNED_IN_STATUS: BackupStatusData = {
  signedIn: true,
  email: 'buyer@example.com',
  userId: 'u-1',
  subscriptionStatus: 'active',
  issuerUrl: 'https://substratesystems.io',
};

describe('auth session truth', () => {
  it('keeps successful authentication authoritative across a failed refresh', () => {
    const signedOut = reconcileAuthStatus(INITIAL_AUTH_SESSION_TRUTH, false);
    const authenticated = authSucceeded(signedOut);

    expect(claimSessionSignedIn(authenticated)).toBe(true);
  });

  it('reconciles successful status and clears truth on logout or auth-required', () => {
    const authenticated = authSucceeded(INITIAL_AUTH_SESSION_TRUTH);
    expect(claimSessionSignedIn(reconcileAuthStatus(authenticated, false))).toBe(false);
    expect(claimSessionSignedIn(sessionSignedOut(authenticated))).toBe(false);
    expect(claimSessionSignedIn(authRequired(authenticated))).toBe(false);
  });

  it('renders authenticated surfaces from authoritative truth when status is unavailable', () => {
    const authenticated = authSucceeded(INITIAL_AUTH_SESSION_TRUTH);

    expect(hostedBackupSessionView(authenticated, null)).toBe('signed-in');
  });

  it('renders checking while truth is unresolved even with a stale signed-out snapshot', () => {
    const staleSignedOut = { ...SIGNED_IN_STATUS, signedIn: false };

    expect(hostedBackupSessionView(INITIAL_AUTH_SESSION_TRUTH, staleSignedOut)).toBe('checking');
  });

  it('shows the blocking session-check modal only for a deferred claim', () => {
    expect(shouldShowSessionCheckModal(INITIAL_AUTH_SESSION_TRUTH, true, true)).toBe(true);
    expect(shouldShowSessionCheckModal(INITIAL_AUTH_SESSION_TRUTH, true, false)).toBe(false);
    expect(shouldShowSessionCheckModal(INITIAL_AUTH_SESSION_TRUTH, false, true)).toBe(false);
    expect(
      shouldShowSessionCheckModal(authSucceeded(INITIAL_AUTH_SESSION_TRUTH), true, true),
    ).toBe(false);
  });

  it('renders signed out and clears a stale signed-in snapshot immediately on logout', () => {
    const signedOut = sessionSignedOut(authSucceeded(INITIAL_AUTH_SESSION_TRUTH));
    const clearedStatus = markBackupStatusSignedOut(SIGNED_IN_STATUS);

    expect(hostedBackupSessionView(signedOut, SIGNED_IN_STATUS)).toBe('signed-out');
    expect(clearedStatus).toMatchObject({ signedIn: false });
    expect(clearedStatus?.email).toBeUndefined();
    expect(clearedStatus?.userId).toBeUndefined();
  });
});
