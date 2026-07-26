import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, within } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SetupFlow } from './setup-flow';
import type { DiscoveredProfile } from '../../../file-discovery';

vi.mock('@/lib/tauri-bridge', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false),
}));

const profiles: DiscoveredProfile[] = [
  { name: 'work-laptop', path: 'C:\\Setups\\work-laptop\\manifest.jsonc', displayName: 'Work Laptop' },
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

const MANIFEST = JSON.stringify({
  version: 1,
  name: 'work-laptop',
  captured: '2026-07-18T12:00:00Z',
  apps: [{ id: 'vlc', displayName: 'VLC media player' }],
  restore: [{ type: 'copy', source: './configs/vlc/vlcrc' }],
});

describe('SetupFlow — "What\'s inside"', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(MANIFEST);
  });

  it('offers a "What\'s inside" affordance on each profile card', () => {
    renderWithProviders(<SetupFlow {...baseProps} />);

    expect(
      screen.getByRole('button', { name: "What's inside Work Laptop" }),
    ).toBeInTheDocument();
  });

  it('opens the summary for that profile without selecting it', async () => {
    const onProfileSelect = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<SetupFlow {...baseProps} onProfileSelect={onProfileSelect} />);

    await user.click(screen.getByRole('button', { name: "What's inside Work Laptop" }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText("What's inside")).toBeVisible();
    const apps = await screen.findByRole('region', { name: 'Apps' });
    expect(within(apps).getByText('VLC media player')).toBeVisible();

    // Inspecting a bundle must never start a run.
    expect(onProfileSelect).not.toHaveBeenCalled();
    expect(baseProps.onPreview).not.toHaveBeenCalled();
  });

  it('reads the manifest of the card that was clicked', async () => {
    const user = userEvent.setup();
    const { invoke } = await import('@/lib/tauri-bridge');

    renderWithProviders(<SetupFlow {...baseProps} />);

    await user.click(screen.getByRole('button', { name: "What's inside Work Laptop" }));
    await screen.findByRole('dialog');

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('read_text_file', {
      path: 'C:\\Setups\\work-laptop\\manifest.jsonc',
    });
  });

  it('keeps the summary closed until the affordance is used', () => {
    renderWithProviders(<SetupFlow {...baseProps} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
