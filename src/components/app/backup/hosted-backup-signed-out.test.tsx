import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { HostedBackupSignedOut } from './hosted-backup-signed-out';

describe('HostedBackupSignedOut', () => {
  it('limits the restore claim to another Windows PC and supported setup content', () => {
    renderWithProviders(
      <HostedBackupSignedOut
        onSignIn={vi.fn()}
        onCreateAccount={vi.fn()}
        onUsePurchaseCode={vi.fn()}
      />,
    );

    expect(screen.getByText(/another Windows PC/i)).toBeInTheDocument();
    expect(screen.getByText(/Endstate application list and supported non-secret settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/any machine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/€4|billed monthly|substratesystems\.io/i)).not.toBeInTheDocument();
  });

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

  it('uses neutral sign-in-only copy when the provider is unknown', () => {
    renderWithProviders(
      <HostedBackupSignedOut
        providerKind="unknown"
        onSignIn={vi.fn()}
        onCreateAccount={vi.fn()}
        onUsePurchaseCode={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Backup service' })).toBeInTheDocument();
    expect(screen.queryByText(/Endstate Cloud|self-hosted/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account|purchase code/i })).not.toBeInTheDocument();
  });
});
