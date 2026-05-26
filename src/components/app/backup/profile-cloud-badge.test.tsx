import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { ProfileCloudBadge } from './profile-cloud-badge';
import type { BackupListItem } from '@/types';

const ENTRY: BackupListItem = {
  id: 'b-1',
  name: 'work-laptop',
  latestVersionId: 'v-1',
  versionCount: 3,
  totalSize: 12345,
  updatedAt: new Date().toISOString(),
};

describe('ProfileCloudBadge', () => {
  it('renders nothing when cloudEntry is undefined', () => {
    const { container } = renderWithProviders(
      <ProfileCloudBadge cloudEntry={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the compact variant by default', () => {
    renderWithProviders(<ProfileCloudBadge cloudEntry={ENTRY} />);
    const badge = screen.getByTestId('profile-cloud-badge');
    expect(badge).toHaveAttribute('data-variant', 'compact');
    expect(badge).toHaveTextContent(/^Backed up$/);
  });

  it('renders the detailed variant with version count and relative time', () => {
    renderWithProviders(
      <ProfileCloudBadge cloudEntry={ENTRY} variant="detailed" />,
    );
    const badge = screen.getByTestId('profile-cloud-badge');
    expect(badge).toHaveAttribute('data-variant', 'detailed');
    expect(badge).toHaveTextContent(/3 versions/);
    // The exact time wording is owned by formatRelativeTime — assert presence
    // of the separators rather than the value.
    expect(badge).toHaveTextContent(/Backed up · 3 versions · /);
  });

  it('applies the testId override when provided', () => {
    renderWithProviders(
      <ProfileCloudBadge cloudEntry={ENTRY} testId="profile-card-work-laptop-cloud-badge" />,
    );
    expect(
      screen.getByTestId('profile-card-work-laptop-cloud-badge'),
    ).toBeInTheDocument();
  });
});
