import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { SetupFlow } from './setup-flow';
import { reconcileLiveActivity } from '../../../lib/apply-utils';
import { restoreEventToAppEvent } from '../../../lib/restore-activity';

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
  onOpenProfilesFolder: vi.fn(),
  onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
  onFileDrop: vi.fn(),
  onUnsupportedFiles: vi.fn(),
  onDeleteProfile: vi.fn(),
  isRunning: false,
  setupProgress: null,
  liveAppEvents: [],
  onPreview: vi.fn(),
  onApply: vi.fn(),
};

/** configModuleMap maps wingetId → qualifiedModuleId (matches real engine format: "apps.vscode") */
function makePreviewWithModules() {
  return {
    installed: 3,
    alreadyPresent: 0,
    appEvents: [
      { app: 'Microsoft.VisualStudioCode', action: 'To install', name: 'Visual Studio Code', timestamp: 1 },
      { app: 'Git.Git', action: 'To install', name: 'Git', timestamp: 2 },
      { app: 'Mozilla.Firefox', action: 'To install', name: 'Firefox', timestamp: 3 },
    ],
    restoreModulesAvailable: [
      { id: 'vscode', displayName: 'Visual Studio Code' },
      { id: 'git', displayName: 'Git' },
    ],
    configModuleMap: { 'Microsoft.VisualStudioCode': 'apps.vscode', 'Git.Git': 'apps.git' } as Record<string, string>,
  };
}

describe('SetupFlow — Restore module selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ConfigModuleSelector with display names matching the app list', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    const selector = await screen.findByTestId('config-module-selector');
    expect(selector).toBeInTheDocument();
    // Display names should match app event names, not raw module IDs
    expect(within(selector).getByText('Visual Studio Code')).toBeInTheDocument();
    expect(within(selector).getByText('Git')).toBeInTheDocument();
  });

  it('all modules default to unchecked', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    await screen.findByTestId('config-module-selector');
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).not.toBeChecked();
    });
  });

  it('does not render ConfigModuleSelector when restore intent is apps-only', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('config-module-selector')).not.toBeInTheDocument();
  });

  it('does not render ConfigModuleSelector when no modules available', async () => {
    const previewResult = {
      installed: 3,
      alreadyPresent: 0,
      appEvents: [],
    };
    const onPreview = vi.fn().mockResolvedValue(previewResult);

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('config-module-selector')).not.toBeInTheDocument();
  });

  it('passes selected modules to onApply when user checks modules', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());
    const onApply = vi.fn().mockResolvedValue({
      installed: 3, alreadyPresent: 0, failed: 0, skipped: 0, appEvents: [],
    });

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    // Check "Visual Studio Code" (display name from app event)
    const vscodeCheckbox = await screen.findByRole('checkbox', { name: /visual studio code/i });
    await userEvent.click(vscodeCheckbox);

    const applyButton = screen.getByTestId('setup-flow-apply');
    await userEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledWith(
      mockProfile,
      expect.objectContaining({
        restoreIntent: 'apps-and-settings',
        selectedModules: ['vscode'],
      }),
    );
  });

  it('keeps settings on result rows whose manifest id differs from the package ref', async () => {
    // The engine streams rows by package ref and keys configModuleMap by ref,
    // but the results rows are rebuilt from the envelope actions' manifest ids.
    const preview = makePreviewWithModules();
    const actions = [
      { id: 'vscode', ref: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', status: 'installed' },
      { id: 'git-git', ref: 'Git.Git', name: 'Git', status: 'installed' },
      { id: 'firefox', ref: 'Mozilla.Firefox', name: 'Firefox', status: 'installed' },
    ];
    const liveRows = preview.appEvents.map((event) => ({ ...event, action: 'Installed', statusKey: 'installed' as const }));
    const onPreview = vi.fn().mockResolvedValue(preview);
    const onApply = vi.fn().mockResolvedValue({
      installed: 3, alreadyPresent: 0, failed: 0, skipped: 0,
      appEvents: reconcileLiveActivity(liveRows, actions),
      actions,
      configModuleMap: preview.configModuleMap,
    });

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />);

    await userEvent.click(screen.getByText('test-profile'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('radio', { name: /settings/i }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /^Git/ }));
    await userEvent.click(screen.getByTestId('setup-flow-apply'));

    expect(await screen.findByRole('button', { name: '1 setting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 without settings' })).toBeInTheDocument();
  });

  it('shows only the restore rows under the results settings chip it counts', async () => {
    const preview = makePreviewWithModules();
    const actions = [
      { id: 'vscode', ref: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', status: 'installed' },
      { id: 'git-git', ref: 'Git.Git', name: 'Git', status: 'installed' },
      { id: 'firefox', ref: 'Mozilla.Firefox', name: 'Firefox', status: 'installed' },
    ];
    const liveRows = preview.appEvents.map((event) => ({ ...event, action: 'Installed', statusKey: 'installed' as const }));
    const restoreRow = restoreEventToAppEvent({
      event: 'restore-item', version: 1, runId: 'apply', timestamp: '2025-01-01T00:00:00.000Z',
      id: 'copy:./configs/git/.gitconfig', module: 'apps.git', restorer: 'copy',
      source: './configs/git/.gitconfig', target: '%USERPROFILE%/.gitconfig',
      status: 'restored', reason: null, backupPath: null, targetExisted: true,
    }, { restoreModulesAvailable: preview.restoreModulesAvailable });
    const onPreview = vi.fn().mockResolvedValue(preview);
    const onApply = vi.fn().mockResolvedValue({
      installed: 3, alreadyPresent: 0, failed: 0, skipped: 0,
      appEvents: reconcileLiveActivity([...liveRows, restoreRow], actions),
      actions,
      configModuleMap: preview.configModuleMap,
    });

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />);

    await userEvent.click(screen.getByText('test-profile'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('radio', { name: /settings/i }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /^Git/ }));
    await userEvent.click(screen.getByTestId('setup-flow-apply'));

    await userEvent.click(await screen.findByRole('button', { name: '1 setting restored' }));
    expect(screen.getByText('Git · .gitconfig')).toBeInTheDocument();
    expect(screen.queryByText('Git')).not.toBeInTheDocument();
  });

  it('offers a Windows setting in its own group and passes its full module ID to apply', async () => {
    const preview = makePreviewWithModules();
    const onPreview = vi.fn().mockResolvedValue({
      ...preview,
      restoreModulesAvailable: [
        ...preview.restoreModulesAvailable,
        { id: 'windows-settings.keyboard', displayName: 'Windows keyboard: repeat delay and rate', entryCount: 2 },
      ],
    });
    const onApply = vi.fn().mockResolvedValue({
      installed: 3, alreadyPresent: 0, failed: 0, skipped: 0, appEvents: [],
    });

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />
    );

    await userEvent.click(screen.getByText('test-profile'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });
    expect(screen.getByText('This profile includes settings for 2 apps and 1 Windows setting')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /settings/i }));

    const appGroup = await screen.findByTestId('config-module-selector');
    const windowsGroup = screen.getByTestId('config-module-selector-windows');
    expect(within(appGroup).queryByText('Windows keyboard: repeat delay and rate')).not.toBeInTheDocument();
    expect(within(windowsGroup).getByText('2 values')).toBeInTheDocument();
    await userEvent.click(
      within(windowsGroup).getByRole('checkbox', { name: /windows keyboard: repeat delay and rate/i }),
    );
    await userEvent.click(screen.getByTestId('setup-flow-apply'));

    expect(onApply).toHaveBeenCalledWith(
      mockProfile,
      expect.objectContaining({
        restoreIntent: 'apps-and-settings',
        selectedModules: ['windows-settings.keyboard'],
      }),
    );
  });

  it('keeps Windows settings out of the preview settings chip and counts them apart', async () => {
    const preview = makePreviewWithModules();
    const onPreview = vi.fn().mockResolvedValue({
      ...preview,
      restoreModulesAvailable: [
        ...preview.restoreModulesAvailable,
        { id: 'windows-settings.keyboard', displayName: 'Windows keyboard: repeat delay and rate', entryCount: 2 },
      ],
    });

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} />);

    await userEvent.click(screen.getByText('test-profile'));
    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });
    expect(screen.getByText(/2 app settings and 1 Windows setting available/)).toBeInTheDocument();
    expect(screen.getByTestId('settings-restore-off-summary')).toHaveTextContent(
      "2 app settings and 1 Windows setting are available but won't be restored",
    );

    // The chip promises the rows its filter shows: the two apps with settings.
    await userEvent.click(screen.getByRole('button', { name: '2 settings' }));
    expect(screen.getByText('Visual Studio Code')).toBeInTheDocument();
    expect(screen.getByText('Git')).toBeInTheDocument();
    expect(screen.queryByText('Firefox')).not.toBeInTheDocument();
  });

  it('can restore selected settings when every application is already present', async () => {
    const previewResult = {
      installed: 0,
      alreadyPresent: 89,
      appEvents: [
        { app: 'Microsoft.VisualStudioCode', action: 'OK', name: 'Visual Studio Code', timestamp: 1 },
      ],
      restoreModulesAvailable: [{ id: 'vscode', displayName: 'Visual Studio Code' }],
      configModuleMap: { 'Microsoft.VisualStudioCode': 'apps.vscode' } as Record<string, string>,
    };
    const onPreview = vi.fn().mockResolvedValue(previewResult);
    const onApply = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />
    );

    await userEvent.click(screen.getByText('test-profile'));
    await screen.findByText('Preview complete');
    expect(screen.queryByTestId('setup-flow-apply')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /settings/i }));
    const vscodeCheckbox = await screen.findByRole('checkbox', { name: /visual studio code/i });
    expect(screen.queryByTestId('setup-flow-apply')).not.toBeInTheDocument();

    await userEvent.click(vscodeCheckbox);
    const applyButton = screen.getByTestId('setup-flow-apply');
    expect(applyButton).toBeEnabled();
    await userEvent.click(applyButton);

    expect(screen.getByText('Applying setup...')).toBeVisible();

    expect(onApply).toHaveBeenCalledWith(
      mockProfile,
      expect.objectContaining({
        restoreIntent: 'apps-and-settings',
        selectedModules: ['vscode'],
      }),
    );
  });

  it('passes empty selectedModules when no modules checked', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());
    const onApply = vi.fn().mockResolvedValue({
      installed: 3, alreadyPresent: 0, failed: 0, skipped: 0, appEvents: [],
    });

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    await screen.findByTestId('config-module-selector');
    const applyButton = screen.getByTestId('setup-flow-apply');
    await userEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledWith(
      mockProfile,
      expect.objectContaining({
        restoreIntent: 'apps-and-settings',
        selectedModules: [],
      }),
    );
  });

  it('clears selectedModules when switching back to apps-only', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());
    const onApply = vi.fn().mockResolvedValue({
      installed: 3, alreadyPresent: 0, failed: 0, skipped: 0, appEvents: [],
    });

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    // Check a module
    const vscodeCheckbox = await screen.findByRole('checkbox', { name: /visual studio code/i });
    await userEvent.click(vscodeCheckbox);

    // Switch back to apps-only
    const appsOnlyRadio = screen.getByRole('radio', { name: /apps only/i });
    await userEvent.click(appsOnlyRadio);

    await waitFor(() => {
      expect(onPreview).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('radio', { name: /apps only/i })).toBeChecked();
    });
    const applyButton = screen.getByTestId('setup-flow-apply');
    await userEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledWith(
      mockProfile,
      expect.objectContaining({
        restoreIntent: 'apps-only',
        selectedModules: [],
      }),
    );
  });

  it('falls back to module ID when app event has no display name', async () => {
    const previewResult = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [
        { app: 'Some.App', action: 'To install', timestamp: 1 }, // no name field
      ],
      restoreModulesAvailable: [{ id: 'someapp', displayName: 'Some App' }],
      configModuleMap: { 'Some.App': 'apps.someapp' } as Record<string, string>,
    };
    const onPreview = vi.fn().mockResolvedValue(previewResult);

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    // Uses engine-provided displayName
    expect(await screen.findByText('Some App')).toBeInTheDocument();
  });

  it('select all button selects all modules', async () => {
    const onPreview = vi.fn().mockResolvedValue(makePreviewWithModules());

    renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} />
    );

    const profileButton = screen.getByText('test-profile');
    await userEvent.click(profileButton);

    await waitFor(() => {
      expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
    });

    const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
    await userEvent.click(appsAndSettingsRadio);

    // Click "Select all"
    const toggleAll = await screen.findByTestId('config-module-toggle-all');
    expect(toggleAll).toHaveTextContent('Select all');
    await userEvent.click(toggleAll);

    // All checkboxes should now be checked
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeChecked();
    });
  });
});
