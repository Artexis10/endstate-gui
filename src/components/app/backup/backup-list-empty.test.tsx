import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { BackupListEmpty } from './backup-list-empty';

describe('BackupListEmpty', () => {
  it('renders the inactive prose for none subscription', () => {
    renderWithProviders(<BackupListEmpty subscriptionStatus="none" />);
    expect(screen.getByTestId('backup-list-empty')).toHaveAttribute('data-variant', 'inactive');
    expect(screen.getByText(/No backups yet/i)).toBeInTheDocument();
  });

  it('renders the inactive prose for cancelled subscription', () => {
    renderWithProviders(<BackupListEmpty subscriptionStatus="cancelled" />);
    expect(screen.getByTestId('backup-list-empty')).toHaveAttribute('data-variant', 'inactive');
  });

  it('renders the active variant with the Capture CTA when active', () => {
    const onCapture = vi.fn();
    renderWithProviders(
      <BackupListEmpty subscriptionStatus="active" onCapture={onCapture} />,
    );
    expect(screen.getByTestId('backup-list-empty')).toHaveAttribute('data-variant', 'active');
    expect(
      screen.getByText(/create your first cloud backup/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('backup-list-empty-capture'));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it('omits the Push-existing CTA when no profile is selected', () => {
    renderWithProviders(
      <BackupListEmpty
        subscriptionStatus="active"
        onCapture={vi.fn()}
        onPushExisting={vi.fn()}
        selectedProfileName={null}
      />,
    );
    expect(
      screen.queryByTestId('backup-list-empty-push-existing'),
    ).not.toBeInTheDocument();
  });

  it('renders the Push-existing CTA when a profile is selected', () => {
    const onPushExisting = vi.fn();
    renderWithProviders(
      <BackupListEmpty
        subscriptionStatus="active"
        onCapture={vi.fn()}
        onPushExisting={onPushExisting}
        selectedProfileName="work-laptop"
      />,
    );
    const pushBtn = screen.getByTestId('backup-list-empty-push-existing');
    expect(pushBtn).toHaveTextContent('Push work-laptop');
    fireEvent.click(pushBtn);
    expect(onPushExisting).toHaveBeenCalledTimes(1);
  });

  it('omits the Capture CTA when no handler is provided', () => {
    renderWithProviders(<BackupListEmpty subscriptionStatus="active" />);
    expect(
      screen.queryByTestId('backup-list-empty-capture'),
    ).not.toBeInTheDocument();
  });
});
