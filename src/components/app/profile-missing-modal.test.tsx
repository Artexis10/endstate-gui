import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { ProfileMissingModal } from './profile-missing-modal';

function makeProps(overrides: Partial<Parameters<typeof ProfileMissingModal>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    previousName: 'work-laptop',
    firstAvailableLabel: 'gaming-pc',
    hasCloudBackup: false,
    onSwitchToFirstAvailable: vi.fn(),
    onRestoreFromCloud: vi.fn(),
    onContinueWithoutProfile: vi.fn(),
    ...overrides,
  };
}

describe('ProfileMissingModal', () => {
  it('renders the missing Capture profile headline with explanatory body', () => {
    renderWithProviders(<ProfileMissingModal {...makeProps()} />);
    expect(
      screen.getByText(/"work-laptop" couldn't be found/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Capture profile/i)).toBeInTheDocument();
    expect(screen.getByText(/profiles folder changed/i)).toBeInTheDocument();
  });

  it('omits the Restore from cloud button when hasCloudBackup is false', () => {
    renderWithProviders(<ProfileMissingModal {...makeProps({ hasCloudBackup: false })} />);
    expect(screen.queryByTestId('profile-missing-restore-cloud')).not.toBeInTheDocument();
  });

  it('renders the Restore from cloud button when hasCloudBackup is true', () => {
    const onRestoreFromCloud = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ProfileMissingModal
        {...makeProps({ hasCloudBackup: true, onRestoreFromCloud, onOpenChange })}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-missing-restore-cloud'));
    expect(onRestoreFromCloud).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('omits the Switch button when no fallback profile is available', () => {
    renderWithProviders(
      <ProfileMissingModal {...makeProps({ firstAvailableLabel: null })} />,
    );
    expect(screen.queryByTestId('profile-missing-switch')).not.toBeInTheDocument();
  });

  it('Switch action mirrors the previous auto-switch and closes the modal', () => {
    const onSwitchToFirstAvailable = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ProfileMissingModal
        {...makeProps({ onSwitchToFirstAvailable, onOpenChange })}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-missing-switch'));
    expect(onSwitchToFirstAvailable).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not offer a Setup picker as a replacement Capture target', () => {
    renderWithProviders(<ProfileMissingModal {...makeProps()} />);
    expect(screen.queryByText('Pick another profile')).not.toBeInTheDocument();
  });

  it('Continue without fires its callback and closes', () => {
    const onContinueWithoutProfile = vi.fn();
    renderWithProviders(
      <ProfileMissingModal
        {...makeProps({ onContinueWithoutProfile })}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-missing-continue-without'));
    expect(onContinueWithoutProfile).toHaveBeenCalledTimes(1);
  });
});
