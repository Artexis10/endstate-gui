import { StrictMode, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaimIntentHandler } from '@/lib/claim-intent-source';
import { useClaimOnboarding } from './use-claim-onboarding';
import {
  INITIAL_AUTH_SESSION_TRUTH,
  authSucceeded,
  claimSessionSignedIn,
  reconcileAuthStatus,
} from './auth-session-truth';

const claimIntentHandlers: ClaimIntentHandler[] = [];
const unsubscribeHandlers: ReturnType<typeof vi.fn>[] = [];
const subscribeMock = vi.fn(async (handler: ClaimIntentHandler) => {
  claimIntentHandlers.push(handler);
  const unsubscribe = vi.fn();
  unsubscribeHandlers.push(unsubscribe);
  return unsubscribe;
});

vi.mock('@/lib/claim-intent-source', () => ({
  subscribeToClaimIntents: (handler: ClaimIntentHandler) => subscribeMock(handler),
}));

const TOKEN_A = 'A'.repeat(43);
const TOKEN_B = 'B'.repeat(43);

beforeEach(() => {
  claimIntentHandlers.length = 0;
  unsubscribeHandlers.length = 0;
  subscribeMock.mockClear();
});

function setup(
  signedIn: boolean | undefined,
  onSignOut = vi.fn(async () => {}),
  recoveryPending = false,
) {
  const onOpenClaim = vi.fn();
  const { result, rerender, unmount } = renderHook(
    ({ session, recovery }) => useClaimOnboarding({
      signedIn: session,
      recoveryPending: recovery,
      onOpenClaim,
      onSignOut,
    }),
    { initialProps: { session: signedIn, recovery: recoveryPending } },
  );
  return { result, rerender, unmount, onOpenClaim, onSignOut };
}

describe('useClaimOnboarding', () => {
  it('defers a cold intent until session state resolves, then routes signed out', async () => {
    const view = setup(undefined);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));

    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));
    expect(view.result.current.claimSetup).toBeNull();
    expect(view.result.current.sessionCheckPending).toBe(true);

    view.rerender({ session: false, recovery: false });
    await waitFor(() => expect(view.result.current.claimSetup?.token).toBe(TOKEN_A));
    expect(view.result.current.sessionCheckPending).toBe(false);
    expect(view.onOpenClaim).toHaveBeenCalledOnce();
  });

  it('gives every warm intent a new key and replaces the active claim', async () => {
    const view = setup(false);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));

    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));
    const first = view.result.current.claimSetup;
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_B }));

    expect(view.result.current.claimSetup?.token).toBe(TOKEN_B);
    expect(view.result.current.claimSetup?.requestId).toBeGreaterThan(first?.requestId ?? 0);
    expect(view.onOpenClaim).toHaveBeenCalledTimes(2);
  });

  it('opens manual claim mode with an explicit empty token', () => {
    const view = setup(false);
    act(() => view.result.current.startManualClaim());
    expect(view.result.current.claimSetup?.token).toBe('');
    expect(view.onOpenClaim).toHaveBeenCalledOnce();
  });

  it('defers manual claim entry until unresolved session truth is checked', async () => {
    const view = setup(undefined);

    act(() => view.result.current.startManualClaim());
    expect(view.result.current.claimSetup).toBeNull();
    expect(view.result.current.sessionCheckPending).toBe(true);

    view.rerender({ session: false, recovery: false });
    await waitFor(() => expect(view.result.current.claimSetup?.token).toBe(''));
    expect(view.onOpenClaim).toHaveBeenCalledOnce();
  });

  it('keeps a signed-in intent pending until sign-out succeeds', async () => {
    const onSignOut = vi.fn(async () => {});
    const view = setup(true, onSignOut);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));

    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));
    expect(view.result.current.collisionPending).not.toBeNull();
    expect(view.result.current.claimSetup).toBeNull();

    await act(() => view.result.current.signOutAndContinue());
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(view.result.current.collisionPending).toBeNull();
    expect(view.result.current.claimSetup?.token).toBe(TOKEN_A);
  });

  it('cancel discards a signed-in intent without signing out or navigating', async () => {
    const view = setup(true);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));

    act(() => view.result.current.cancelCollision());
    expect(view.result.current.collisionPending).toBeNull();
    expect(view.onSignOut).not.toHaveBeenCalled();
    expect(view.onOpenClaim).not.toHaveBeenCalled();
  });

  it('keeps the session and pending token when logout fails', async () => {
    const onSignOut = vi.fn(async () => { throw new Error('engine failure'); });
    const view = setup(true, onSignOut);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));

    await act(() => view.result.current.signOutAndContinue());
    expect(view.result.current.collisionPending?.token).toBe(TOKEN_A);
    expect(view.result.current.logoutError).toMatch(/couldn't sign you out/i);
    expect(view.onOpenClaim).not.toHaveBeenCalled();
  });

  it('defers the latest warm intent while recovery is pending without replacing the active setup', async () => {
    const view = setup(false);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));
    const activeRequestId = view.result.current.claimSetup?.requestId;

    view.rerender({ session: false, recovery: true });
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_B }));

    expect(view.result.current.claimSetup?.token).toBe(TOKEN_A);
    expect(view.result.current.claimSetup?.requestId).toBe(activeRequestId);
    expect(view.onOpenClaim).toHaveBeenCalledOnce();

    view.rerender({ session: true, recovery: false });
    await waitFor(() => expect(view.result.current.collisionPending?.token).toBe(TOKEN_B));
    expect(view.onOpenClaim).toHaveBeenCalledOnce();
  });

  it('treats deferred recovery intent as a collision when auth succeeds but status refresh fails', async () => {
    let sessionTruth = reconcileAuthStatus(INITIAL_AUTH_SESSION_TRUTH, false);
    const view = setup(claimSessionSignedIn(sessionTruth), undefined, true);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));

    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_B }));
    sessionTruth = authSucceeded(sessionTruth);
    // A rejected post-auth status refresh leaves the conservative auth truth intact.
    view.rerender({
      session: claimSessionSignedIn(sessionTruth),
      recovery: false,
    });

    await waitFor(() => expect(view.result.current.collisionPending?.token).toBe(TOKEN_B));
    expect(view.result.current.claimSetup).toBeNull();
    expect(view.onOpenClaim).not.toHaveBeenCalled();
  });

  it('opens the latest collision token when a newer intent arrives during logout', async () => {
    let resolveLogout: (() => void) | undefined;
    const onSignOut = vi.fn(() => new Promise<void>((resolve) => { resolveLogout = resolve; }));
    const view = setup(true, onSignOut);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A }));

    let logout: Promise<void> | undefined;
    act(() => { logout = view.result.current.signOutAndContinue(); });
    act(() => claimIntentHandlers[0]({ type: 'claim', token: TOKEN_B }));
    await act(async () => {
      resolveLogout?.();
      await logout;
    });

    expect(view.result.current.claimSetup?.token).toBe(TOKEN_B);
    expect(view.result.current.collisionPending).toBeNull();
  });

  it('subscribes once and unsubscribes on unmount', async () => {
    const view = setup(false);
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(1));
    view.rerender({ session: true, recovery: false });
    view.unmount();
    await waitFor(() => expect(unsubscribeHandlers[0]).toHaveBeenCalledOnce());
  });

  it('ignores intents delivered to the disposed StrictMode subscription', async () => {
    const onOpenClaim = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result, unmount } = renderHook(
      () => useClaimOnboarding({
        signedIn: false,
        recoveryPending: false,
        onOpenClaim,
        onSignOut: async () => {},
      }),
      { wrapper },
    );
    await waitFor(() => expect(claimIntentHandlers).toHaveLength(2));

    act(() => {
      claimIntentHandlers[0]({ type: 'claim', token: TOKEN_A });
      claimIntentHandlers[1]({ type: 'claim', token: TOKEN_A });
    });

    expect(result.current.claimSetup?.token).toBe(TOKEN_A);
    expect(onOpenClaim).toHaveBeenCalledOnce();
    await waitFor(() => expect(unsubscribeHandlers[0]).toHaveBeenCalledOnce());
    unmount();
    await waitFor(() => expect(unsubscribeHandlers[1]).toHaveBeenCalledOnce());
  });
});
