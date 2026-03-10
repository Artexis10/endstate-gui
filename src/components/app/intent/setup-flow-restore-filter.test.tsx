import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '../../../test/test-utils';
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
    restoreModulesAvailable: ['vscode', 'git'],
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

    const selector = screen.getByTestId('config-module-selector');
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
    const vscodeCheckbox = screen.getByRole('checkbox', { name: /visual studio code/i });
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
    const vscodeCheckbox = screen.getByRole('checkbox', { name: /visual studio code/i });
    await userEvent.click(vscodeCheckbox);

    // Switch back to apps-only
    const appsOnlyRadio = screen.getByRole('radio', { name: /apps only/i });
    await userEvent.click(appsOnlyRadio);

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
      restoreModulesAvailable: ['someapp'],
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

    // Falls back to raw module ID
    expect(screen.getByText('someapp')).toBeInTheDocument();
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
    const toggleAll = screen.getByTestId('config-module-toggle-all');
    expect(toggleAll).toHaveTextContent('Select all');
    await userEvent.click(toggleAll);

    // All checkboxes should now be checked
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeChecked();
    });
  });
});
