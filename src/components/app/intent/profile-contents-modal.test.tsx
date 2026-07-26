import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ProfileContentsModal } from './profile-contents-modal';
import { useShowDetails } from '@/lib/use-show-details';

vi.mock('@/lib/tauri-bridge', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false),
}));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  profilePath: 'C:\\Setups\\my-desktop\\manifest.jsonc',
  profileDisplayName: 'My desktop',
};

/** A v1 profile: two apps, three restore entries across two modules. */
const V1_MANIFEST = JSON.stringify({
  version: 1,
  name: 'my-desktop',
  captured: '2026-07-18T12:00:00Z',
  apps: [
    { id: 'vlc', displayName: 'VLC media player', refs: { windows: 'VideoLAN.VLC' } },
    { id: 'notepad-plus-plus', displayName: 'Notepad++', refs: { windows: 'Notepad++.Notepad++' } },
  ],
  restore: [
    { type: 'copy', source: './configs/vlc/vlcrc' },
    { type: 'copy', source: './configs/notepad-plus-plus/config.xml' },
    { type: 'copy', source: './configs/notepad-plus-plus/shortcuts.xml' },
  ],
});

async function mockManifest(content: string) {
  const { invoke } = await import('@/lib/tauri-bridge');
  vi.mocked(invoke).mockResolvedValue(content);
}

/** The Apps / Settings sections are named regions, so each can be queried alone. */
const appsSection = () => screen.findByRole('region', { name: 'Apps' });
const settingsSection = () => screen.findByRole('region', { name: 'Settings' });

describe('ProfileContentsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useShowDetails).mockReturnValue(false);
  });

  it('renders nothing when closed', () => {
    render(<ProfileContentsModal {...defaultProps} open={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders app and settings counts from the manifest', async () => {
    await mockManifest(V1_MANIFEST);

    render(<ProfileContentsModal {...defaultProps} />);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByText('2 apps')).toBeVisible();
    });
    expect(within(dialog).getByText('2 settings')).toBeVisible();
  });

  it('lists apps by display name', async () => {
    await mockManifest(V1_MANIFEST);

    render(<ProfileContentsModal {...defaultProps} />);

    const apps = await appsSection();
    expect(within(apps).getByText('VLC media player')).toBeVisible();
    expect(within(apps).getByText('Notepad++')).toBeVisible();
  });

  it('lists settings modules by display name with their file counts', async () => {
    await mockManifest(V1_MANIFEST);

    render(<ProfileContentsModal {...defaultProps} />);

    const settings = await settingsSection();
    // VLC contributes one file, Notepad++ two.
    expect(within(settings).getByText('VLC media player')).toBeVisible();
    expect(within(settings).getByText('1 file')).toBeVisible();
    expect(within(settings).getByText('Notepad++')).toBeVisible();
    expect(within(settings).getByText('2 files')).toBeVisible();
  });

  it('falls back to the package ref when an app has no display name', async () => {
    await mockManifest(
      JSON.stringify({
        version: 1,
        apps: [{ id: 'jq', refs: { windows: 'jqlang.jq' } }],
      }),
    );

    render(<ProfileContentsModal {...defaultProps} />);

    expect(await screen.findByText('jqlang.jq')).toBeVisible();
  });

  it('shows the captured timestamp', async () => {
    await mockManifest(V1_MANIFEST);

    render(<ProfileContentsModal {...defaultProps} />);

    expect(await screen.findByText(/captured/i)).toBeVisible();
  });

  it('states calmly that an install-only profile has no settings', async () => {
    await mockManifest(
      JSON.stringify({
        version: 1,
        name: 'apps-only',
        apps: [{ id: 'jq', displayName: 'jq' }],
      }),
    );

    render(<ProfileContentsModal {...defaultProps} />);

    expect(
      await screen.findByText('This profile installs apps only — no settings are included.'),
    ).toBeVisible();
    expect(screen.getByText('1 app')).toBeVisible();
    // A settings-free profile is a normal outcome, not a warning.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('states that a settings-only profile installs no apps', async () => {
    await mockManifest(
      JSON.stringify({
        version: 1,
        apps: [],
        restore: [{ type: 'copy', source: './configs/vlc/vlcrc' }],
      }),
    );

    render(<ProfileContentsModal {...defaultProps} />);

    expect(
      await screen.findByText('This profile carries settings only — it installs no apps.'),
    ).toBeVisible();
  });

  it('does not leak raw module ids into the summary', async () => {
    await mockManifest(
      JSON.stringify({
        version: 2,
        name: 'capture-v2',
        apps: [],
        configCaptures: [
          {
            captureId: 'photoshop-preferences-installed',
            moduleId: 'apps.photoshop',
            configSetId: 'preferences',
            payloadManifest: [{ relativePath: 'prefs.psp' }],
          },
        ],
      }),
    );

    render(<ProfileContentsModal {...defaultProps} />);

    await screen.findByText('1 setting');
    // The module is counted, but nothing names it with its engine id.
    expect(screen.queryByText('apps.photoshop')).not.toBeInTheDocument();
    expect(screen.queryByText('photoshop')).not.toBeInTheDocument();
    expect(screen.queryByText('photoshop-preferences-installed')).not.toBeInTheDocument();
    expect(screen.queryByText('preferences')).not.toBeInTheDocument();
  });

  it('reveals module ids and the file path only under Configuration details', async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    await mockManifest(V1_MANIFEST);
    const user = userEvent.setup();

    render(<ProfileContentsModal {...defaultProps} />);

    await appsSection();
    expect(screen.queryByText(/notepad-plus-plus/)).not.toBeInTheDocument();
    expect(screen.queryByText(defaultProps.profilePath)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configuration details' }));

    expect(screen.getByText('notepad-plus-plus, vlc')).toBeInTheDocument();
    expect(screen.getByText(defaultProps.profilePath)).toBeInTheDocument();
  });

  it('hides the details disclosure entirely when show-details is off', async () => {
    await mockManifest(V1_MANIFEST);

    render(<ProfileContentsModal {...defaultProps} />);

    await appsSection();
    expect(
      screen.queryByRole('button', { name: 'Configuration details' }),
    ).not.toBeInTheDocument();
  });

  it('surfaces a read failure instead of an empty summary', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockRejectedValue(new Error('File does not exist'));

    render(<ProfileContentsModal {...defaultProps} />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('This profile could not be read.')).toBeVisible();
    expect(within(alert).getByText('File does not exist')).toBeVisible();
  });

  it('closes when Close is pressed', async () => {
    await mockManifest(V1_MANIFEST);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<ProfileContentsModal {...defaultProps} onOpenChange={onOpenChange} />);

    await appsSection();
    // The footer button and the Dialog's own sr-only dismiss both read "Close";
    // the footer one renders first.
    const [footerClose] = screen.getAllByRole('button', { name: 'Close' });
    await user.click(footerClose);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
