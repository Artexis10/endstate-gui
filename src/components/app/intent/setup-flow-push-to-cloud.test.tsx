import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';
import type { BackupListItem } from '../../../types';
import type { DiscoveredProfile } from '../../../file-discovery';

const profiles: DiscoveredProfile[] = [
  { name: 'cloud-pc', path: 'C:\\profiles\\cloud-pc.jsonc' },
  { name: 'local-pc', path: 'C:\\profiles\\local-pc.jsonc' },
];

const baseProps = {
  profiles,
  onBack: vi.fn(),
  onProfileSelect: vi.fn(),
  onOpenProfilesFolder: vi.fn(),
  onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
  onFileDrop: vi.fn(),
  onDeleteProfile: vi.fn(),
  isRunning: false,
  setupProgress: null,
  liveAppEvents: [],
  onPreview: vi.fn(),
  onApply: vi.fn(),
};

// Keyed by profileKey (path) — the cloud badge now derives from the id-mapping,
// so a hosted profile is identified by its path key, not its name.
const cloudIndex: Map<string, BackupListItem> = new Map([
  ['C:\\profiles\\cloud-pc.jsonc', {
    id: 'b-cloud-pc',
    name: 'cloud-pc',
    versionCount: 2,
    totalSize: 1024,
    updatedAt: '2026-05-10T20:00:00Z',
  }],
]);

describe('SetupFlow — "Back up to cloud" action on local-only profile cards', () => {
  it('does not render the action when the user is signed out', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={false}
        hostedBackupSubscriptionStatus="active"
        cloudBackupIndex={cloudIndex}
        onPushProfileToCloud={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('profile-card-local-pc-push-to-cloud')).not.toBeInTheDocument();
  });

  it('does not render the action when the subscription is not active', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        hostedBackupSubscriptionStatus="grace"
        cloudBackupIndex={cloudIndex}
        onPushProfileToCloud={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('profile-card-local-pc-push-to-cloud')).not.toBeInTheDocument();
  });

  it('does not render the action when the parent omits the handler', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        hostedBackupSubscriptionStatus="active"
        cloudBackupIndex={cloudIndex}
      />,
    );
    expect(screen.queryByTestId('profile-card-local-pc-push-to-cloud')).not.toBeInTheDocument();
  });

  it('does not render the action on cloud-backed profile cards', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        hostedBackupSubscriptionStatus="active"
        cloudBackupIndex={cloudIndex}
        onPushProfileToCloud={vi.fn()}
      />,
    );
    // cloud-pc IS in the index — should not show the action
    expect(screen.queryByTestId('profile-card-cloud-pc-push-to-cloud')).not.toBeInTheDocument();
  });

  it('renders the action on local-only profile cards when conditions are met', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        hostedBackupSubscriptionStatus="active"
        cloudBackupIndex={cloudIndex}
        onPushProfileToCloud={vi.fn()}
      />,
    );
    const action = screen.getByTestId('profile-card-local-pc-push-to-cloud');
    expect(action).toBeInTheDocument();
    expect(action).toHaveTextContent(/Back up to cloud/);
  });

  it('fires onPushProfileToCloud with the profile path and name on click', () => {
    const onPushProfileToCloud = vi.fn();
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        hostedBackupSubscriptionStatus="active"
        cloudBackupIndex={cloudIndex}
        onPushProfileToCloud={onPushProfileToCloud}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-card-local-pc-push-to-cloud'));
    expect(onPushProfileToCloud).toHaveBeenCalledTimes(1);
    expect(onPushProfileToCloud).toHaveBeenCalledWith(
      'C:\\profiles\\local-pc.jsonc',
      'local-pc',
    );
  });

  it('does not propagate the click to the parent card (select handler stays untriggered)', () => {
    const onProfileSelect = vi.fn();
    const onPushProfileToCloud = vi.fn();
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onProfileSelect={onProfileSelect}
        hostedBackupSignedIn={true}
        hostedBackupSubscriptionStatus="active"
        cloudBackupIndex={cloudIndex}
        onPushProfileToCloud={onPushProfileToCloud}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-card-local-pc-push-to-cloud'));
    expect(onPushProfileToCloud).toHaveBeenCalledTimes(1);
    expect(onProfileSelect).not.toHaveBeenCalled();
  });
});
