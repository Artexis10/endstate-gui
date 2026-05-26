import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';
import type { BackupListItem } from '../../../types';
import type { DiscoveredProfile } from '../../../file-discovery';

const profiles: DiscoveredProfile[] = [
  { name: 'work-laptop', path: 'C:\\profiles\\work-laptop.jsonc', displayName: 'Work Laptop' },
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

function makeIndex(names: string[]): Map<string, BackupListItem> {
  const m = new Map<string, BackupListItem>();
  for (const name of names) {
    m.set(name, {
      id: `b-${name}`,
      name,
      versionCount: 2,
      totalSize: 1024,
      updatedAt: '2026-05-10T20:00:00Z',
    });
  }
  return m;
}

describe('SetupFlow — Restore from Hosted Backup CTA', () => {
  it('does not render the CTA when the user is not signed in', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={false}
        cloudBackupIndex={makeIndex(['work-laptop'])}
        onRestoreFromCloud={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('setup-restore-from-cloud-cta'),
    ).not.toBeInTheDocument();
  });

  it('does not render the CTA when there are no cloud backups', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        cloudBackupIndex={new Map()}
        onRestoreFromCloud={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('setup-restore-from-cloud-cta'),
    ).not.toBeInTheDocument();
  });

  it('does not render the CTA when the parent omits the handler', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        cloudBackupIndex={makeIndex(['work-laptop'])}
      />,
    );
    expect(
      screen.queryByTestId('setup-restore-from-cloud-cta'),
    ).not.toBeInTheDocument();
  });

  it('renders the CTA when signed in with at least one cloud backup', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        cloudBackupIndex={makeIndex(['work-laptop'])}
        onRestoreFromCloud={vi.fn()}
      />,
    );
    const cta = screen.getByTestId('setup-restore-from-cloud-cta');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent(/Restore from your Hosted Backup/);
    expect(cta).toHaveTextContent(/1 backup available/);
  });

  it('pluralises copy when multiple cloud backups exist', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        cloudBackupIndex={makeIndex(['work-laptop', 'tablet', 'gaming-pc'])}
        onRestoreFromCloud={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId('setup-restore-from-cloud-cta'),
    ).toHaveTextContent(/3 backups available/);
  });

  it('fires onRestoreFromCloud when the CTA is clicked', () => {
    const onRestoreFromCloud = vi.fn();
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        hostedBackupSignedIn={true}
        cloudBackupIndex={makeIndex(['work-laptop'])}
        onRestoreFromCloud={onRestoreFromCloud}
      />,
    );
    fireEvent.click(screen.getByTestId('setup-restore-from-cloud-cta'));
    expect(onRestoreFromCloud).toHaveBeenCalledTimes(1);
  });

  it('does not fire the callback while a setup is running', () => {
    const onRestoreFromCloud = vi.fn();
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        isRunning={true}
        hostedBackupSignedIn={true}
        cloudBackupIndex={makeIndex(['work-laptop'])}
        onRestoreFromCloud={onRestoreFromCloud}
      />,
    );
    fireEvent.click(screen.getByTestId('setup-restore-from-cloud-cta'));
    expect(onRestoreFromCloud).not.toHaveBeenCalled();
  });
});
