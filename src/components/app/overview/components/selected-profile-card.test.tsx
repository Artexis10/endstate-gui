import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../../test/test-utils';
import { SelectedProfileCard } from './selected-profile-card';
import type { DiscoveredProfile } from '@/file-discovery';

const profiles: DiscoveredProfile[] = [
  { name: 'work.jsonc', path: 'C:\\profiles\\work.jsonc', displayName: 'Work Setup' },
  { name: 'home.jsonc', path: 'C:\\profiles\\home.jsonc', displayName: 'Home Setup' },
  { name: 'minimal.json', path: 'C:\\profiles\\minimal.json' },
];

const defaultProps = {
  selectedProfile: 'work.jsonc',
  profiles,
  isRunning: false,
  onProfileChange: vi.fn(),
  onManageProfiles: vi.fn(),
};

describe('SelectedProfileCard', () => {
  it('displays displayName for profiles that have one', () => {
    renderWithProviders(<SelectedProfileCard {...defaultProps} />);
    // The selected profile "work.jsonc" has displayName "Work Setup"
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Work Setup');
  });

  it('calls onManageProfiles when manage button is clicked', () => {
    const onManageProfiles = vi.fn();
    renderWithProviders(
      <SelectedProfileCard {...defaultProps} onManageProfiles={onManageProfiles} />
    );
    screen.getByRole('button', { name: /manage profiles/i }).click();
    expect(onManageProfiles).toHaveBeenCalledTimes(1);
  });

  it('disables both select and manage button when isRunning', () => {
    renderWithProviders(<SelectedProfileCard {...defaultProps} isRunning={true} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /manage profiles/i })).toBeDisabled();
  });

  it('enables both select and manage button when not running', () => {
    renderWithProviders(<SelectedProfileCard {...defaultProps} isRunning={false} />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /manage profiles/i })).not.toBeDisabled();
  });

  it('renders a combobox even with empty profiles list', () => {
    renderWithProviders(
      <SelectedProfileCard {...defaultProps} profiles={[]} selectedProfile="" />
    );
    // Select should still render even with no options
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  it('displays the file icon', () => {
    renderWithProviders(<SelectedProfileCard {...defaultProps} />);
    // FileText icon renders as an SVG inside the container
    const container = screen.getByTestId('current-profile-card-content');
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
