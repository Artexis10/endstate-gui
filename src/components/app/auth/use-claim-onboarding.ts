import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToClaimIntents } from '@/lib/claim-intent-source';
import type { ClaimIntent } from '@/lib/claim-intent';

export interface ClaimSetupRequest {
  requestId: number;
  token: string;
}

interface UseClaimOnboardingOptions {
  /** Undefined until the initial Hosted Backup status check resolves. */
  signedIn: boolean | undefined;
  recoveryPending: boolean;
  onOpenClaim: () => void;
  onSignOut: () => Promise<void>;
}

export function useClaimOnboarding({
  signedIn,
  recoveryPending,
  onOpenClaim,
  onSignOut,
}: UseClaimOnboardingOptions) {
  const [claimSetup, setClaimSetup] = useState<ClaimSetupRequest | null>(null);
  const [collisionPending, setCollisionPending] = useState<ClaimSetupRequest | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [sessionCheckPending, setSessionCheckPending] = useState(false);

  const signedInRef = useRef(signedIn);
  const recoveryPendingRef = useRef(recoveryPending);
  const onOpenClaimRef = useRef(onOpenClaim);
  const onSignOutRef = useRef(onSignOut);
  const deferredRequestRef = useRef<ClaimSetupRequest | null>(null);
  const requestIdRef = useRef(0);
  const collisionPendingRef = useRef<ClaimSetupRequest | null>(null);

  signedInRef.current = signedIn;
  recoveryPendingRef.current = recoveryPending;
  onOpenClaimRef.current = onOpenClaim;
  onSignOutRef.current = onSignOut;

  const openClaim = useCallback((request: ClaimSetupRequest) => {
    collisionPendingRef.current = null;
    setCollisionPending(null);
    setLogoutError(null);
    setClaimSetup(request);
    onOpenClaimRef.current();
  }, []);

  const holdCollision = useCallback((request: ClaimSetupRequest) => {
    collisionPendingRef.current = request;
    setClaimSetup(null);
    setLogoutError(null);
    setCollisionPending(request);
  }, []);

  const routeRequest = useCallback((request: ClaimSetupRequest) => {
    const currentSignedIn = signedInRef.current;

    if (recoveryPendingRef.current) {
      deferredRequestRef.current = request;
      return;
    }
    if (currentSignedIn === undefined) {
      deferredRequestRef.current = request;
      setSessionCheckPending(true);
      return;
    }
    if (currentSignedIn) {
      holdCollision(request);
      return;
    }
    openClaim(request);
  }, [holdCollision, openClaim]);

  const acceptIntent = useCallback((intent: ClaimIntent) => {
    routeRequest({ requestId: ++requestIdRef.current, token: intent.token });
  }, [routeRequest]);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    let active = true;
    const deliverIfActive = (intent: ClaimIntent) => {
      if (active) acceptIntent(intent);
    };

    void subscribeToClaimIntents(deliverIfActive)
      .then((stop) => {
        if (disposed) stop();
        else unsubscribe = stop;
      })
      .catch(() => {});

    return () => {
      active = false;
      disposed = true;
      unsubscribe?.();
    };
  }, [acceptIntent]);

  useEffect(() => {
    if (recoveryPending || !deferredRequestRef.current) return;
    if (signedIn === undefined) {
      setSessionCheckPending(true);
      return;
    }
    const request = deferredRequestRef.current;
    deferredRequestRef.current = null;
    setSessionCheckPending(false);
    if (signedIn) holdCollision(request);
    else openClaim(request);
  }, [signedIn, recoveryPending, holdCollision, openClaim]);

  const startManualClaim = useCallback(() => {
    routeRequest({ requestId: ++requestIdRef.current, token: '' });
  }, [routeRequest]);

  const cancelCollision = useCallback(() => {
    collisionPendingRef.current = null;
    setCollisionPending(null);
    setLogoutError(null);
  }, []);

  const clearClaimSetup = useCallback(() => {
    setClaimSetup(null);
  }, []);

  const signOutAndContinue = useCallback(async () => {
    if (!collisionPending || logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await onSignOutRef.current();
      const latestRequest = collisionPendingRef.current;
      if (latestRequest) openClaim(latestRequest);
    } catch {
      setLogoutError(
        "We couldn't sign you out. Your current account is still signed in. Try again.",
      );
    } finally {
      setLogoutBusy(false);
    }
  }, [collisionPending, logoutBusy, openClaim]);

  return {
    claimSetup,
    collisionPending,
    logoutBusy,
    logoutError,
    sessionCheckPending,
    startManualClaim,
    clearClaimSetup,
    cancelCollision,
    signOutAndContinue,
  };
}
