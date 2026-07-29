import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiscoveredProfile } from '../../../file-discovery';
import { renderWithProviders } from '../../../test/test-utils';
import { SetupFlow, type SetupFlowProps } from './setup-flow';

const importedProfile: DiscoveredProfile = {
  name: 'captured-bundle',
  path: 'C:\\profiles\\captured-bundle\\manifest.jsonc',
};

const existingProfile: DiscoveredProfile = {
  name: 'existing-profile',
  path: 'C:\\profiles\\existing-profile.jsonc',
};

const laterImportedProfile: DiscoveredProfile = {
  name: 'later-bundle',
  path: 'C:\\profiles\\later-bundle\\manifest.jsonc',
};

const previewResult = {
  installed: 0,
  alreadyPresent: 0,
  appEvents: [],
  actions: [],
};

function makeProps(overrides: Partial<SetupFlowProps> = {}): SetupFlowProps {
  return {
    profiles: [existingProfile, importedProfile],
    recentlyImportedProfile: importedProfile,
    onRecentlyImportedConsumed: vi.fn(),
    onBack: vi.fn(),
    onOpenProfilesFolder: vi.fn(),
    onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
    onFileDrop: vi.fn(),
    onDeleteProfile: vi.fn(),
    isRunning: false,
    setupProgress: null,
    liveAppEvents: [],
    onPreview: vi.fn().mockResolvedValue(previewResult),
    onApply: vi.fn(),
    ...overrides,
  };
}

function setupFlow(props: SetupFlowProps) {
  return <SetupFlow {...props} />;
}

describe('SetupFlow imported profile handoff', () => {
  it('keeps the exact imported profile in browse until Review setup starts one install-only preview', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn().mockResolvedValue(previewResult);
    const onRecentlyImportedConsumed = vi.fn();
    const props = makeProps({
      onPreview,
      onRecentlyImportedConsumed,
    });
    const { rerender } = renderWithProviders(setupFlow(props));

    expect(onPreview).not.toHaveBeenCalled();

    const importedCard = screen.getByTestId('profile-card-captured-bundle');
    const existingCard = screen.getByTestId('profile-card-existing-profile');
    expect(within(importedCard).getByText('Imported')).toBeVisible();
    expect(within(importedCard).getByRole('button', { name: 'Review setup' })).toBeVisible();
    expect(within(importedCard).getByRole('button', { name: 'Delete captured-bundle' })).not.toHaveAttribute('tabindex', '-1');
    expect(within(existingCard).queryByText('Imported')).not.toBeInTheDocument();
    expect(within(existingCard).queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();

    await user.click(within(importedCard).getByRole('button', { name: 'Review setup' }));

    await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(1));
    expect(onPreview).toHaveBeenCalledWith(importedProfile, { restoreIntent: 'apps-only' });
    expect(onRecentlyImportedConsumed).toHaveBeenCalledTimes(1);

    rerender(setupFlow({
      ...props,
      recentlyImportedProfile: null,
    }));
    await user.click(screen.getByTestId('setup-flow-back'));
    expect(screen.queryByText('Imported')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
  });

  it('moves one-shot emphasis to the most recently imported profile without previewing either profile', () => {
    const onPreview = vi.fn().mockResolvedValue(previewResult);
    const props = makeProps({ onPreview });
    const { rerender } = renderWithProviders(setupFlow(props));

    expect(within(screen.getByTestId('profile-card-captured-bundle')).getByText('Imported')).toBeVisible();
    expect(within(screen.getByTestId('profile-card-existing-profile')).queryByText('Imported')).not.toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();

    rerender(setupFlow({
      ...props,
      profiles: [existingProfile, importedProfile, laterImportedProfile],
      recentlyImportedProfile: laterImportedProfile,
    }));

    expect(within(screen.getByTestId('profile-card-captured-bundle')).queryByText('Imported')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('profile-card-captured-bundle')).queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('profile-card-later-bundle')).getByText('Imported')).toBeVisible();
    expect(within(screen.getByTestId('profile-card-later-bundle')).getByRole('button', { name: 'Review setup' })).toBeVisible();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('clears recent-import emphasis when the imported profile is deleted without starting a latent preview', async () => {
    const user = userEvent.setup();
    const onDeleteProfile = vi.fn();
    const onPreview = vi.fn().mockResolvedValue(previewResult);
    const props = makeProps({ onDeleteProfile, onPreview });
    const { rerender } = renderWithProviders(setupFlow(props));

    const importedCard = screen.getByTestId('profile-card-captured-bundle');
    await user.click(within(importedCard).getByRole('button', { name: 'Delete captured-bundle' }));
    expect(onDeleteProfile).toHaveBeenCalledWith(importedProfile.path, importedProfile.name);

    rerender(setupFlow({
      ...props,
      profiles: [existingProfile],
      recentlyImportedProfile: null,
    }));

    expect(screen.queryByText('Imported')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('clears recent-import emphasis on flow reset without starting a latent preview', () => {
    const onPreview = vi.fn().mockResolvedValue(previewResult);
    const props = makeProps({ onPreview, resetKey: 0 });
    const { rerender } = renderWithProviders(setupFlow(props));

    expect(screen.getByText('Imported')).toBeVisible();

    rerender(setupFlow({
      ...props,
      recentlyImportedProfile: null,
      resetKey: 1,
    }));

    expect(screen.queryByText('Imported')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review setup' })).not.toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('reports an explicit preview failure without rewriting the completed import', async () => {
    const user = userEvent.setup();
    const previewError = new Error('Engine rejected capture provenance');
    const onPreview = vi.fn().mockRejectedValue(previewError);
    const onRecentlyImportedConsumed = vi.fn();
    const props = makeProps({ onPreview, onRecentlyImportedConsumed });
    const { rerender } = renderWithProviders(setupFlow(props));

    expect(onPreview).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Review setup' }));

    expect(await screen.findByText(previewError.message)).toBeVisible();
    expect(screen.queryByText(/import failed/i)).not.toBeInTheDocument();
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(importedProfile, { restoreIntent: 'apps-only' });
    expect(onRecentlyImportedConsumed).toHaveBeenCalledTimes(1);

    rerender(setupFlow({
      ...props,
      recentlyImportedProfile: null,
    }));
    await user.click(screen.getByTestId('setup-flow-back'));
    expect(screen.getByTestId('profile-card-captured-bundle')).toBeVisible();
    expect(screen.queryByText('Imported')).not.toBeInTheDocument();
  });
});
