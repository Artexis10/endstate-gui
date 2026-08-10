import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../test/test-utils';
import { HostedBackupChip } from './hosted-backup-chip';

describe('HostedBackupChip', () => {
  it('renders nothing when hosted backup is unsupported', () => {
    const { container } = renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported={false}
        signedIn={false}
        onOpen={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('hosted-backup-chip')).not.toBeInTheDocument();
  });

  it('renders the sign-in CTA when signed out', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        signedIn={false}
        onOpen={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveAttribute('data-state', 'signed-out');
    expect(chip.textContent).toMatch(/Sign in to Endstate Cloud/i);
  });

  it('uses neutral self-hosted language without a managed-service subscription CTA', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        providerKind="self-hosted"
        signedIn
        subscriptionStatus="none"
        onOpen={vi.fn()}
      />,
    );

    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveTextContent('Self-hosted backup');
    expect(chip).not.toHaveTextContent('Endstate Cloud');
    expect(chip).not.toHaveTextContent('Subscribe');
  });

  it('uses neutral language rather than a managed offer for an unknown provider', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        providerKind="unknown"
        signedIn={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByTestId('hosted-backup-chip')).toHaveTextContent('Open backup service');
    expect(screen.getByTestId('hosted-backup-chip')).not.toHaveTextContent(/Endstate Cloud|self-hosted/i);
  });

  it('renders the active chip when subscription is active', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        signedIn
        subscriptionStatus="active"
        onOpen={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveAttribute('data-state', 'active');
    expect(chip.textContent).toMatch(/Active/);
    expect(chip).not.toHaveAttribute('title', expect.stringMatching(/up to date/i));
  });

  it('renders the cancelled chip with "Renew" label', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        signedIn
        subscriptionStatus="cancelled"
        onOpen={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveAttribute('data-state', 'cancelled');
    expect(chip.textContent).toMatch(/Renew/);
  });

  it('renders the grace chip with "Fix billing" label', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        signedIn
        subscriptionStatus="grace"
        onOpen={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveAttribute('data-state', 'grace');
    expect(chip.textContent).toMatch(/Fix billing/);
  });

  it.each(['grace', 'cancelled'] as const)('keeps unknown %s status neutral', (subscriptionStatus) => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        providerKind="unknown"
        signedIn
        subscriptionStatus={subscriptionStatus}
        onOpen={vi.fn()}
      />,
    );

    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveTextContent('Backup service · Needs attention');
    expect(chip).not.toHaveTextContent(/Endstate Cloud|Renew|Fix billing|self-hosted/i);
  });

  it('falls back to "Subscribe" when signed in but no active subscription', () => {
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        signedIn
        subscriptionStatus="none"
        onOpen={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('hosted-backup-chip');
    expect(chip).toHaveAttribute('data-state', 'none');
    expect(chip.textContent).toMatch(/Subscribe/);
  });

  it('invokes onOpen on click', () => {
    const onOpen = vi.fn();
    renderWithProviders(
      <HostedBackupChip
        hostedBackupSupported
        signedIn={false}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByTestId('hosted-backup-chip'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
