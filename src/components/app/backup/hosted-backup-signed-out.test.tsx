import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { HostedBackupSignedOut } from './hosted-backup-signed-out';

describe('HostedBackupSignedOut', () => {
  it('exposes purchase-code fallback beside sign-in and account creation', async () => {
    const user = userEvent.setup();
    const onUsePurchaseCode = vi.fn();
    renderWithProviders(
      <HostedBackupSignedOut
        onSignIn={vi.fn()}
        onCreateAccount={vi.fn()}
        onUsePurchaseCode={onUsePurchaseCode}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use purchase code' }));
    expect(onUsePurchaseCode).toHaveBeenCalledOnce();
  });
});
