import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiscoveredProfile } from '../../../file-discovery';
import { renderWithProviders } from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';

const importedProfile: DiscoveredProfile = {
  name: 'captured-bundle',
  path: 'C:\\profiles\\captured-bundle\\manifest.jsonc',
};

describe('SetupFlow imported profile handoff', () => {
  it('selects and previews a newly imported profile exactly once', async () => {
    const onProfileSelect = vi.fn();
    const onPreview = vi.fn().mockResolvedValue({ actions: [] });
    const onProfileToOpenConsumed = vi.fn();

    renderWithProviders(
      <SetupFlow
        profiles={[importedProfile]}
        profileToOpen={importedProfile}
        onProfileToOpenConsumed={onProfileToOpenConsumed}
        onBack={vi.fn()}
        onProfileSelect={onProfileSelect}
        onOpenProfilesFolder={vi.fn()}
        onRefreshProfiles={vi.fn().mockResolvedValue(undefined)}
        onFileDrop={vi.fn()}
        onDeleteProfile={vi.fn()}
        isRunning={false}
        setupProgress={null}
        liveAppEvents={[]}
        onPreview={onPreview}
        onApply={vi.fn()}
      />,
    );

    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(importedProfile));
    expect(onProfileSelect).toHaveBeenCalledWith(importedProfile);
    expect(onProfileToOpenConsumed).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });
});
