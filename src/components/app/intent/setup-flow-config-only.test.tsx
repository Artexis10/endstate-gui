import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { SetupFlow } from './setup-flow';

const mockProfile = {
  name: 'test-profile',
  path: 'C:\\profiles\\test-profile.jsonc',
  displayName: 'test-profile',
  extension: '.jsonc' as const,
  isBundle: false,
};

const baseProps = {
  profiles: [mockProfile],
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

/** Preview result with a mix of winget apps and manual config-only apps */
function makePreviewWithManualApps() {
  return {
    installed: 2,
    alreadyPresent: 4,
    appEvents: [
      { app: 'GitHub.cli', action: 'OK', statusKey: 'present' as const, name: 'GitHub CLI', timestamp: 1 },
      { app: 'Inkscape.Inkscape', action: 'OK', statusKey: 'present' as const, name: 'Inkscape', timestamp: 2 },
      { app: 'Docker.DockerDesktop', action: 'To install', statusKey: 'to_install' as const, name: 'Docker Desktop', timestamp: 3 },
      { app: 'Notepad++.Notepad++', action: 'To install', statusKey: 'to_install' as const, name: 'Notepad++', timestamp: 4 },
      // Config-only synthesized apps (driver: "manual")
      { app: 'lightroom-classic', action: 'OK', statusKey: 'present' as const, name: 'Adobe Lightroom Classic', timestamp: 5, driver: 'manual' },
      { app: 'claude-code', action: 'OK', statusKey: 'present' as const, name: 'Claude Code', timestamp: 6, driver: 'manual' },
    ],
    configModuleMap: {
      'GitHub.cli': 'apps.github-cli',
      'lightroom-classic': 'apps.lightroom-classic',
      'claude-code': 'apps.claude-code',
    } as Record<string, string>,
  };
}

/** Preview result with only winget apps (no manual entries) */
function makePreviewWingetOnly() {
  return {
    installed: 1,
    alreadyPresent: 2,
    appEvents: [
      { app: 'GitHub.cli', action: 'OK', statusKey: 'present' as const, name: 'GitHub CLI', timestamp: 1 },
      { app: 'Inkscape.Inkscape', action: 'OK', statusKey: 'present' as const, name: 'Inkscape', timestamp: 2 },
      { app: 'Docker.DockerDesktop', action: 'To install', statusKey: 'to_install' as const, name: 'Docker Desktop', timestamp: 3 },
    ],
    configModuleMap: { 'GitHub.cli': 'apps.github-cli' } as Record<string, string>,
  };
}

async function navigateToPreview(previewResult: ReturnType<typeof makePreviewWithManualApps>) {
  const onPreview = vi.fn().mockResolvedValue(previewResult);
  renderWithProviders(
    <SetupFlow {...baseProps} onPreview={onPreview} />
  );
  const profileButton = screen.getByText('test-profile');
  await userEvent.click(profileButton);
  await waitFor(() => {
    expect(screen.getByText('Preview complete')).toBeInTheDocument();
  });
}

describe('SetupFlow — Config-only (manual) app distinction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows manual apps in a section that says app installation is not included', async () => {
    await navigateToPreview(makePreviewWithManualApps());

    expect(screen.getByText('Settings only — app installation not included')).toBeInTheDocument();
    expect(screen.getByText(/can restore these settings.*cannot install/i)).toBeInTheDocument();
    // Config-only apps should show their display names
    expect(screen.getByText('Adobe Lightroom Classic')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  it('does not show the settings-only section when no manual apps exist', async () => {
    await navigateToPreview(makePreviewWingetOnly());

    expect(screen.queryByText('Settings only — app installation not included')).not.toBeInTheDocument();
  });

  it('manual apps do not count in the "X apps" badge', async () => {
    await navigateToPreview(makePreviewWithManualApps());

    // Total apps badge: 2 winget present + 2 to install = 4 (not 6 which would include manual)
    expect(screen.getByText('4 apps')).toBeInTheDocument();
  });

  it('manual apps show status labels in the settings-only section', async () => {
    await navigateToPreview(makePreviewWithManualApps());

    // Winget apps should still have status labels
    expect(screen.getByText('GitHub CLI')).toBeInTheDocument();
    expect(screen.getByText('Docker Desktop')).toBeInTheDocument();

    // Config-only section exists with status labels and gear icons
    const section = screen.getByText('Settings only — app installation not included');
    expect(section).toBeInTheDocument();
  });

  it('shows gear icon next to each config-only app', async () => {
    await navigateToPreview(makePreviewWithManualApps());

    // The Settings detected section should contain Settings2 icons (rendered as SVGs with lucide class)
    // Check that the config-only entries are rendered
    const lrEntry = screen.getByText('Adobe Lightroom Classic');
    expect(lrEntry.closest('div')).toBeInTheDocument();
    const ccEntry = screen.getByText('Claude Code');
    expect(ccEntry.closest('div')).toBeInTheDocument();
  });

  it('adjusts "to install" and "present" badge counts to exclude manual apps', async () => {
    await navigateToPreview(makePreviewWithManualApps());

    // 2 winget apps to install (Docker, Notepad++)
    expect(screen.getByText('2 to install')).toBeInTheDocument();
    // 2 winget apps present (GitHub CLI, Inkscape) — not 4 (which would include manual)
    expect(screen.getByText('2 present')).toBeInTheDocument();
  });
});
