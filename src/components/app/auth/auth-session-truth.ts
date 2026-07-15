import type { BackupStatusData } from '@/types';

export interface AuthSessionTruth {
  resolved: boolean;
  knownAuthenticated: boolean;
}

export const INITIAL_AUTH_SESSION_TRUTH: AuthSessionTruth = {
  resolved: false,
  knownAuthenticated: false,
};

export function reconcileAuthStatus(
  _current: AuthSessionTruth,
  signedIn: boolean,
): AuthSessionTruth {
  return { resolved: true, knownAuthenticated: signedIn };
}

export function authSucceeded(_current: AuthSessionTruth): AuthSessionTruth {
  return { resolved: true, knownAuthenticated: true };
}

export function sessionSignedOut(_current: AuthSessionTruth): AuthSessionTruth {
  return { resolved: true, knownAuthenticated: false };
}

export function authRequired(current: AuthSessionTruth): AuthSessionTruth {
  return sessionSignedOut(current);
}

export function claimSessionSignedIn(
  truth: AuthSessionTruth,
): boolean | undefined {
  return truth.resolved ? truth.knownAuthenticated : undefined;
}

export function shouldShowSessionCheckModal(
  truth: AuthSessionTruth,
  failed: boolean,
  claimPending: boolean,
): boolean {
  return failed && !truth.resolved && claimPending;
}

export type HostedBackupSessionView = 'checking' | 'signed-in' | 'signed-out';

export function hostedBackupSessionView(
  truth: AuthSessionTruth,
  _status: BackupStatusData | null,
): HostedBackupSessionView {
  if (truth.resolved) {
    return truth.knownAuthenticated ? 'signed-in' : 'signed-out';
  }
  return 'checking';
}

export function markBackupStatusSignedOut(
  status: BackupStatusData | null,
): BackupStatusData | null {
  if (!status) return null;
  return {
    ...status,
    signedIn: false,
    email: undefined,
    userId: undefined,
    subscriptionStatus: undefined,
    lastBackupAt: undefined,
    quotaUsedBytes: undefined,
    quotaTotalBytes: undefined,
    versionCount: undefined,
    graceEndsAt: undefined,
  };
}
