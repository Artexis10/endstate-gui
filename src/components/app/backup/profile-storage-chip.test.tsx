import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { ProfileStorageChip } from './profile-storage-chip';
import type { BackupListItem } from '@/types';

const ENTRY: BackupListItem = {
  id: 'b-1',
  name: 'work-laptop',
  latestVersionId: 'v-1',
  versionCount: 3,
  totalSize: 12345,
  updatedAt: '2026-05-10T20:00:00Z',
};

describe('ProfileStorageChip', () => {
  it('renders the cloud variant when cloudEntry is set', () => {
    renderWithProviders(<ProfileStorageChip cloudEntry={ENTRY} />);
    const chip = screen.getByTestId('profile-storage-chip');
    expect(chip).toHaveAttribute('data-state', 'cloud');
    expect(chip).toHaveTextContent('Cloud');
    expect(chip).not.toHaveTextContent('Local only');
  });

  it('renders the local-only variant when cloudEntry is undefined', () => {
    renderWithProviders(<ProfileStorageChip cloudEntry={undefined} />);
    const chip = screen.getByTestId('profile-storage-chip');
    expect(chip).toHaveAttribute('data-state', 'local');
    expect(chip).toHaveTextContent('Local only');
    expect(chip).not.toHaveTextContent(/^Cloud$/);
  });

  it('always renders something (never null) so list rows align', () => {
    const { container: a } = renderWithProviders(
      <ProfileStorageChip cloudEntry={ENTRY} />,
    );
    const { container: b } = renderWithProviders(
      <ProfileStorageChip cloudEntry={undefined} />,
    );
    expect(a).not.toBeEmptyDOMElement();
    expect(b).not.toBeEmptyDOMElement();
  });

  it('applies the testId override when provided', () => {
    renderWithProviders(
      <ProfileStorageChip
        cloudEntry={ENTRY}
        testId="profile-card-work-laptop-storage-chip"
      />,
    );
    expect(
      screen.getByTestId('profile-card-work-laptop-storage-chip'),
    ).toBeInTheDocument();
  });
});
