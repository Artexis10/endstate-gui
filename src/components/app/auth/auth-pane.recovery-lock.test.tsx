import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthPane } from './auth-pane';
import type { BackupSignupData } from '@/types';
import type { AppSettings } from '@/settings';

const SIGNUP_DATA: BackupSignupData = {
  userId: 'u-1',
  email: 'buyer@example.com',
  subscriptionStatus: 'active',
  recoveryKeySavedTo: 'C:\\tmp\\recovery.txt',
};

vi.mock('./sign-up-form', async () => {
  const { Button } = await import('@/components/ui/button');
  return {
    SignUpForm: ({ onSignedUp }: { onSignedUp: (data: BackupSignupData) => void }) => (
      <Button type="button" onClick={() => onSignedUp(SIGNUP_DATA)}>Complete claim</Button>
    ),
  };
});

vi.mock('./recovery-key-dialog', async () => {
  const { Button } = await import('@/components/ui/button');
  return {
    RecoveryKeyDialog: ({ onContinue }: { onContinue: () => void }) => (
      <Button type="button" onClick={onContinue}>Continue recovery</Button>
    ),
  };
});

describe('AuthPane recovery lock', () => {
  it('keeps recovery pending until asynchronous authentication work completes', async () => {
    const user = userEvent.setup();
    let resolveAuthenticated: (() => void) | undefined;
    const onAuthenticated = vi.fn(() => new Promise<void>((resolve) => {
      resolveAuthenticated = resolve;
    }));
    const recoveryStates: boolean[] = [];

    function Harness() {
      const [, setRecoveryPending] = useState(false);
      return (
        <AuthPane
          settings={{} as AppSettings}
          initialClaimMode
          onAuthenticated={onAuthenticated}
          onRecoveryPendingChange={(pending) => {
            recoveryStates.push(pending);
            setRecoveryPending(pending);
          }}
        />
      );
    }

    renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Complete claim' }));
    expect(recoveryStates[recoveryStates.length - 1]).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Continue recovery' }));
    expect(onAuthenticated).toHaveBeenCalledOnce();
    expect(recoveryStates[recoveryStates.length - 1]).toBe(true);

    resolveAuthenticated?.();
    await waitFor(() => expect(recoveryStates[recoveryStates.length - 1]).toBe(false));
  });
});
