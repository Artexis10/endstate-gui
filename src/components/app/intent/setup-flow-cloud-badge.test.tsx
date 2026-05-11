import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';
import type { BackupListItem } from '../../../types';
import type { DiscoveredProfile } from '../../../file-discovery';

const profiles: DiscoveredProfile[] = [
  { name: 'work-laptop', path: 'C:\\profiles\\work-laptop.jsonc', displayName: 'Work Laptop' },
  { name: 'gaming-pc', path: 'C:\\profiles\\gaming-pc.jsonc' },
  { name: 'tablet', path: 'C:\\profiles\\tablet.jsonc' },
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

describe('SetupFlow — cloud-backed badge', () => {
  it('renders the cloud badge only on profile cards that match the index', () => {
    renderWithProviders(
      <SetupFlow {...baseProps} cloudBackupIndex={makeIndex(['work-laptop', 'tablet'])} />,
    );

    expect(
      screen.getByTestId('profile-card-work-laptop-cloud-badge'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('profile-card-tablet-cloud-badge'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('profile-card-gaming-pc-cloud-badge'),
    ).not.toBeInTheDocument();
  });

  it('renders no cloud badges when the index is empty', () => {
    renderWithProviders(<SetupFlow {...baseProps} cloudBackupIndex={new Map()} />);

    for (const p of profiles) {
      expect(
        screen.queryByTestId(`profile-card-${p.name}-cloud-badge`),
      ).not.toBeInTheDocument();
    }
  });

  it('renders no cloud badges when no index is provided', () => {
    renderWithProviders(<SetupFlow {...baseProps} />);

    for (const p of profiles) {
      expect(
        screen.queryByTestId(`profile-card-${p.name}-cloud-badge`),
      ).not.toBeInTheDocument();
    }
  });

  it('shows backup version count and relative time inline in the badge text', () => {
    renderWithProviders(
      <SetupFlow {...baseProps} cloudBackupIndex={makeIndex(['work-laptop'])} />,
    );

    const badge = screen.getByTestId('profile-card-work-laptop-cloud-badge');
    expect(badge.textContent).toContain('Backed up');
    expect(badge.textContent).toContain('2 versions');
    // formatRelativeTime() output varies with wall-clock; just assert "ago"
    // is present (covers minutes/hours/days) or "yesterday" / "just now".
    expect(badge.textContent).toMatch(/ago|yesterday|just now/);
  });
});
