import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, userEvent, waitFor, within } from '@/test/test-utils';
import type { ConfigResolution } from '@/types';
import { EngineEnvelopeError } from '@/lib/engine-envelope-error';
import { SetupFlow } from './setup-flow';

const profile = {
  name: 'generation-profile',
  path: 'C:\\profiles\\generation-profile.zip',
  displayName: 'generation-profile',
  extension: '.zip' as const,
  isBundle: true,
};

const otherProfile = {
  ...profile,
  name: 'other-generation-profile',
  path: 'C:\\profiles\\other-generation-profile.zip',
  displayName: 'other-generation-profile',
};

function configResolution(
  overrides: Partial<ConfigResolution> & Pick<ConfigResolution, 'captureId' | 'resolution' | 'label'>,
): ConfigResolution {
  return {
    moduleId: 'apps.photoshop',
    configSetId: 'preferences',
    targetCandidates: [],
    reason: null,
    migrationPath: [],
    resolvedTargets: [],
    status: 'skipped',
    message: `Message for ${overrides.captureId}`,
    remediation: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const baseProps = {
  profiles: [profile],
  onBack: vi.fn(),
  onProfileSelect: vi.fn(),
  onOpenProfilesFolder: vi.fn(),
  onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
  onFileDrop: vi.fn(),
  onDeleteProfile: vi.fn(),
  isRunning: false,
  setupProgress: null,
  liveAppEvents: [],
  liveConfigEvents: [],
  restoreTargetSupported: true,
  onPreview: vi.fn(),
  onApply: vi.fn(),
};

describe('SetupFlow config generations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps native acceptance visible when previewing replaces the Setup drop zone', async () => {
    const pending = deferred<{
      installed: number;
      alreadyPresent: number;
      appEvents: [];
    }>();
    const onPreview = vi.fn().mockReturnValue(pending.promise);
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        nativeDragAccepted
      />,
    );

    expect(screen.getByTestId('drop-zone')).toHaveTextContent('Drop to import');
    await user.click(screen.getByText('generation-profile'));
    await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(1));

    expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
    expect(screen.getByTestId('native-profile-drop-feedback')).toHaveTextContent('Drop to import');
  });

  it('summarizes install-only settings once without presenting restore-disabled resolutions', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{
        app: 'Adobe.Photoshop',
        action: 'To install',
        name: 'Adobe Photoshop',
        timestamp: 1,
      }],
      restoreModulesAvailable: [
        { id: 'photoshop', displayName: 'Adobe Photoshop' },
        { id: 'vscode', displayName: 'Visual Studio Code' },
      ],
      configResolutions: [
        configResolution({
          captureId: 'photoshop-disabled',
          resolution: 'unknown',
          label: 'Settings restore disabled',
          message: 'Settings restore is not enabled for this invocation',
        }),
        configResolution({
          captureId: 'vscode-disabled',
          moduleId: 'apps.vscode',
          resolution: 'unknown',
          label: 'Settings restore disabled',
          message: 'Settings restore is not enabled for this invocation',
        }),
      ],
    });
    const user = userEvent.setup();

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} />);

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');

    expect(onPreview).toHaveBeenCalledWith(profile, { restoreIntent: 'apps-only' });
    expect(screen.getAllByText("2 settings are available but won't be restored")).toHaveLength(1);
    expect(screen.queryByTestId('config-resolution-photoshop-disabled')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-vscode-disabled')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings restore is not enabled for this invocation')).not.toBeInTheDocument();
  });

  it('retries a failed settings preview without exposing stale configuration state', async () => {
    const installOnlyPreview = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{ app: 'Vendor.Alpha', action: 'To install', name: 'Alpha package', timestamp: 1 }],
      restoreModulesAvailable: [{ id: 'alpha', displayName: 'Alpha settings' }],
    };
    const recoveredSettingsPreview = {
      ...installOnlyPreview,
      configResolutions: [configResolution({
        captureId: 'recovered-settings',
        resolution: 'direct',
        label: 'Recovered settings preview',
      })],
    };
    const onPreview = vi.fn()
      .mockResolvedValueOnce(installOnlyPreview)
      .mockRejectedValueOnce(new Error('Settings preview unavailable'))
      .mockResolvedValueOnce(recoveredSettingsPreview);
    const user = userEvent.setup();

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} />);

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByRole('radio', { name: /settings/i }));

    expect(await screen.findByText('Settings preview unavailable')).toBeVisible();
    expect(screen.queryByTestId('config-module-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-recovered-settings')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with apps only' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Retry settings preview' }));

    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(3, profile, {
      restoreIntent: 'apps-and-settings',
    }));
    expect(await screen.findByRole('checkbox', { name: 'Alpha settings' })).not.toBeChecked();
    expect(screen.getByText('Recovered settings preview')).toBeVisible();
    expect(screen.queryByText('Settings preview unavailable')).not.toBeInTheDocument();
  });

  it('retries an engine-declared unsuccessful settings preview', async () => {
    const installOnlyPreview = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{ app: 'Vendor.Alpha', action: 'To install', name: 'Alpha package', timestamp: 1 }],
      restoreModulesAvailable: [{ id: 'alpha', displayName: 'Alpha settings' }],
    };
    const unsuccessfulSettingsPreview = {
      ...installOnlyPreview,
      success: false,
      error: { code: 'SETTINGS_PREVIEW_FAILED', message: 'Engine settings preview failed' },
      configResolutions: [configResolution({
        captureId: 'failed-settings',
        resolution: 'legacy_unverified',
        label: 'Engine-authored settings warning',
      })],
    };
    const onPreview = vi.fn()
      .mockResolvedValueOnce(installOnlyPreview)
      .mockResolvedValueOnce(unsuccessfulSettingsPreview)
      .mockResolvedValueOnce(installOnlyPreview);
    const user = userEvent.setup();

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} />);

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByRole('radio', { name: /settings/i }));

    expect(await screen.findByText('Preview completed with errors')).toBeVisible();
    expect(screen.getByText('Engine settings preview failed')).toBeVisible();
    expect(screen.getByText('Engine-authored settings warning')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry settings preview' }));

    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(3, profile, {
      restoreIntent: 'apps-and-settings',
    }));
    expect(await screen.findByText('Preview complete')).toBeVisible();
    expect(screen.queryByText('Engine settings preview failed')).not.toBeInTheDocument();
  });

  it('does not label a failed live Apply as a settings-preview retry', async () => {
    const preview = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{ app: 'Vendor.Alpha', action: 'To install', name: 'Alpha package', timestamp: 1 }],
      restoreModulesAvailable: [{ id: 'alpha', displayName: 'Alpha settings' }],
    };
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={vi.fn().mockResolvedValue(preview)}
        onApply={vi.fn().mockRejectedValue(new Error('Live Apply unavailable'))}
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByRole('radio', { name: /settings/i }));
    await user.click(await screen.findByRole('checkbox', { name: 'Alpha settings' }));
    await user.click(screen.getByTestId('setup-flow-apply'));

    expect(await screen.findByText('Live Apply unavailable')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry settings preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with apps only' })).toBeVisible();
  });

  it('keeps legacy consent unchecked and forwards only an explicit target mapping', async () => {
    const installOnlyPreview = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{
        app: 'Adobe.Photoshop',
        action: 'To install',
        name: 'Adobe Photoshop',
        timestamp: 1,
      }],
      restoreModulesAvailable: [{ id: 'photoshop', displayName: 'Adobe Photoshop' }],
      configResolutions: [configResolution({
        captureId: 'restore-disabled',
        resolution: 'unknown',
        label: 'Settings restore disabled',
        message: 'Settings restore is not enabled for this invocation',
      })],
    };
    const restoreEnabledPreview = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{
        app: 'Adobe.Photoshop',
        action: 'To install',
        name: 'Adobe Photoshop',
        timestamp: 1,
      }],
      restoreModulesAvailable: [{ id: 'photoshop', displayName: 'Adobe Photoshop' }],
      configModuleMap: { 'Adobe.Photoshop': 'apps.photoshop' },
      configResolutions: [
        configResolution({
          captureId: 'legacy-capture',
          resolution: 'legacy_unverified',
          label: 'Compatibility unknown',
          message: 'Engine legacy warning',
        }),
        configResolution({
          captureId: 'ambiguous-capture',
          resolution: 'unknown',
          label: 'Engine target warning',
          reason: 'ambiguous_target_instance',
          targetCandidates: [
            {
              id: 'photoshop-2024',
              moduleId: 'apps.photoshop',
              detectorId: 'photoshop-install',
              rawVersion: '25.0',
              normalizedVersion: '25.0.0',
              evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
              restoreModuleRevision: 'revision-restore',
            },
            {
              id: 'photoshop-2025',
              moduleId: 'apps.photoshop',
              detectorId: 'photoshop-install',
              rawVersion: '26.0',
              normalizedVersion: '26.0.0',
              evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
              restoreModuleRevision: 'revision-restore',
            },
          ],
        }),
      ],
    };
    const onPreview = vi.fn()
      .mockResolvedValueOnce(installOnlyPreview)
      .mockResolvedValueOnce(restoreEnabledPreview);
    const onApply = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      failed: 0,
      skipped: 0,
      appEvents: [],
    });
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    expect(screen.queryByText('Engine legacy warning')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /settings/i }));

    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(2, profile, {
      restoreIntent: 'apps-and-settings',
    }));
    expect(await screen.findByText('Engine legacy warning')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('config-resolution-group-legacy_unverified')).getByText('Adobe Photoshop'),
    ).toBeVisible();

    const legacyConsent = screen.getByRole('checkbox', { name: 'Adobe Photoshop' });
    expect(legacyConsent).not.toBeChecked();
    await user.click(legacyConsent);

    const targetSelector = screen.getByRole('combobox', { name: /target for ambiguous-capture/i });
    expect(targetSelector).toHaveAttribute('data-placeholder');
    await user.click(targetSelector);
    await user.click(screen.getByRole('option', { name: 'photoshop-2025 · 26.0' }));

    await user.click(screen.getByTestId('setup-flow-apply'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    // objectContaining: options also carry the threaded display-name context
    // (restoreModulesAvailable / configModuleMap) from the preview envelope.
    expect(onApply).toHaveBeenCalledWith(profile, expect.objectContaining({
      restoreIntent: 'apps-and-settings',
      selectedModules: ['photoshop'],
      restoreTargets: [{
        captureId: 'ambiguous-capture',
        targetInstanceId: 'photoshop-2025',
      }],
    }));
  });

  it('refreshes both restore intents, blocks Apply while pending, and preserves stable app choices', async () => {
    const installOnlyPreview = {
      installed: 2,
      alreadyPresent: 0,
      appEvents: [
        { app: 'Vendor.Alpha', action: 'To install', name: 'Alpha package', timestamp: 1 },
        { app: 'Vendor.Bravo', action: 'To install', name: 'Bravo package', timestamp: 2 },
      ],
      actions: [
        { type: 'install', id: 'alpha', ref: 'Vendor.Alpha', status: 'to_install', message: '' },
        { type: 'install', id: 'bravo', ref: 'Vendor.Bravo', status: 'to_install', message: '' },
      ],
      restoreModulesAvailable: [{ id: 'photoshop', displayName: 'Catalog Photoshop' }],
      configResolutions: [configResolution({
        captureId: 'install-only-stale',
        resolution: 'unknown',
        label: 'Settings restore disabled',
      })],
    };
    const restoreEnabledPreview = {
      ...installOnlyPreview,
      appEvents: [
        { app: 'Vendor.Bravo', action: 'To install', name: 'Bravo package', timestamp: 3 },
        { app: 'Vendor.Alpha', action: 'To install', name: 'Alpha package', timestamp: 4 },
      ],
      actions: [
        { type: 'install', id: 'bravo', ref: 'Vendor.Bravo', status: 'to_install', message: '' },
        { type: 'install', id: 'alpha', ref: 'Vendor.Alpha', status: 'to_install', message: '' },
      ],
      configModuleMap: { 'Vendor.Alpha': 'apps.photoshop' },
      configResolutions: [configResolution({
        captureId: 'restore-target',
        resolution: 'unknown',
        label: 'Choose an engine target',
        reason: 'ambiguous_target_instance',
        targetCandidates: [{
          id: 'photoshop-current',
          moduleId: 'apps.photoshop',
          detectorId: 'photoshop-install',
          rawVersion: '26.0',
          normalizedVersion: '26.0.0',
          evidence: { type: 'registry', appId: 'Vendor.Alpha' },
          restoreModuleRevision: 'revision-restore',
        }],
      })],
    };
    const freshInstallOnlyPreview = {
      ...installOnlyPreview,
      appEvents: [
        { app: 'Vendor.Alpha', action: 'To install', name: 'Fresh install-only Alpha', timestamp: 5 },
        { app: 'Vendor.Bravo', action: 'To install', name: 'Fresh install-only Bravo', timestamp: 6 },
      ],
    };
    const restorePending = deferred<typeof restoreEnabledPreview>();
    const installOnlyPending = deferred<typeof freshInstallOnlyPreview>();
    const onPreview = vi.fn()
      .mockResolvedValueOnce(installOnlyPreview)
      .mockReturnValueOnce(restorePending.promise)
      .mockReturnValueOnce(installOnlyPending.promise);
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        applyOnlySupported
        restoreTargetSupported
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByTestId('app-picker-checkbox-bravo'));
    expect(screen.getByTestId('app-picker-checkbox-alpha')).toBeChecked();
    expect(screen.getByTestId('app-picker-checkbox-bravo')).not.toBeChecked();

    await user.click(screen.getByRole('radio', { name: /settings/i }));

    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(2, profile, {
      restoreIntent: 'apps-and-settings',
    }));
    expect(screen.getByTestId('setup-flow-apply')).toBeDisabled();
    expect(screen.queryByTestId('config-module-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-install-only-stale')).not.toBeInTheDocument();

    await act(async () => {
      restorePending.resolve(restoreEnabledPreview);
    });

    expect(await screen.findByRole('checkbox', { name: 'Catalog Photoshop' })).not.toBeChecked();
    expect(screen.getByTestId('app-picker-checkbox-alpha')).toBeChecked();
    expect(screen.getByTestId('app-picker-checkbox-bravo')).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Catalog Photoshop' }));
    await user.click(screen.getByRole('combobox', { name: /target for restore-target/i }));
    await user.click(screen.getByRole('option', { name: 'photoshop-current · 26.0' }));

    await user.click(screen.getByRole('radio', { name: /apps only/i }));

    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(3, profile, {
      restoreIntent: 'apps-only',
    }));
    expect(screen.getByTestId('setup-flow-apply')).toBeDisabled();
    expect(screen.queryByTestId('config-module-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-restore-target')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /target for restore-target/i })).not.toBeInTheDocument();

    await act(async () => {
      installOnlyPending.resolve(freshInstallOnlyPreview);
    });

    expect(await screen.findByText('Fresh install-only Alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-install-only-stale')).not.toBeInTheDocument();
  });

  it('ignores an older same-profile install-only generation after a reset starts a newer one', async () => {
    const older = deferred<{
      installed: number;
      alreadyPresent: number;
      appEvents: Array<{ app: string; action: string; name: string; timestamp: number }>;
    }>();
    const newer = deferred<{
      installed: number;
      alreadyPresent: number;
      appEvents: Array<{ app: string; action: string; name: string; timestamp: number }>;
    }>();
    const onPreview = vi.fn()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <SetupFlow {...baseProps} onPreview={onPreview} resetKey={0} />,
    );

    await user.click(screen.getByText('generation-profile'));
    await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(1));

    rerender(<SetupFlow {...baseProps} onPreview={onPreview} resetKey={1} />);
    await user.click(await screen.findByText('generation-profile'));
    await waitFor(() => expect(onPreview).toHaveBeenCalledTimes(2));

    await act(async () => {
      newer.resolve({
        installed: 1,
        alreadyPresent: 0,
        appEvents: [{
          app: 'Vendor.Newest',
          action: 'To install',
          name: 'Newest generation app',
          timestamp: 2,
        }],
      });
    });
    expect(await screen.findByText('Newest generation app')).toBeInTheDocument();

    await act(async () => {
      older.resolve({
        installed: 1,
        alreadyPresent: 0,
        appEvents: [{
          app: 'Vendor.Older',
          action: 'To install',
          name: 'Older generation app',
          timestamp: 1,
        }],
      });
    });

    expect(screen.getByText('Newest generation app')).toBeInTheDocument();
    expect(screen.queryByText('Older generation app')).not.toBeInTheDocument();
  });

  it('resets restore consent before previewing a different profile', async () => {
    const preview = {
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{
        app: 'Vendor.Alpha',
        action: 'To install',
        name: 'Alpha package',
        timestamp: 1,
      }],
      restoreModulesAvailable: [{ id: 'alpha', displayName: 'Alpha settings' }],
    };
    const onPreview = vi.fn().mockResolvedValue(preview);
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        profiles={[profile, otherProfile]}
        onPreview={onPreview}
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByRole('radio', { name: /settings/i }));
    await screen.findByRole('checkbox', { name: 'Alpha settings' });
    await user.click(screen.getByRole('checkbox', { name: 'Alpha settings' }));

    await user.click(screen.getByTestId('setup-flow-back'));
    await user.click(screen.getByText('other-generation-profile'));

    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(3, otherProfile, {
      restoreIntent: 'apps-only',
    }));
    await screen.findByText('Preview complete');
    expect(screen.getByRole('radio', { name: /apps only/i })).toBeChecked();
    expect(screen.queryByTestId('config-module-selector')).not.toBeInTheDocument();
  });

  it('drops target mappings that belong to a deselected module', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      installed: 2,
      alreadyPresent: 0,
      appEvents: [],
      restoreModulesAvailable: [
        { id: 'apps.photoshop', displayName: 'Adobe Photoshop' },
        { id: 'apps.vscode', displayName: 'Visual Studio Code' },
      ],
      configResolutions: [
        configResolution({
          captureId: 'photoshop-capture',
          moduleId: 'apps.photoshop',
          resolution: 'unknown',
          label: 'Choose Photoshop target',
          reason: 'ambiguous_target_instance',
          targetCandidates: [{
            id: 'photoshop-2025',
            moduleId: 'apps.photoshop',
            detectorId: 'photoshop-install',
            rawVersion: '26.0',
            normalizedVersion: '26.0.0',
            evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
            restoreModuleRevision: 'revision-restore',
          }],
        }),
        configResolution({
          captureId: 'vscode-capture',
          moduleId: 'apps.vscode',
          resolution: 'unknown',
          label: 'Choose VS Code target',
          reason: 'ambiguous_target_instance',
          targetCandidates: [{
            id: 'vscode-stable',
            moduleId: 'apps.vscode',
            detectorId: 'vscode-install',
            rawVersion: '1.100',
            normalizedVersion: '1.100.0',
            evidence: { type: 'installed-app', appId: 'Microsoft.VisualStudioCode' },
            restoreModuleRevision: 'revision-restore',
          }],
        }),
      ],
    });
    const onApply = vi.fn().mockResolvedValue({
      installed: 2,
      alreadyPresent: 0,
      failed: 0,
      skipped: 0,
      appEvents: [],
    });
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByRole('radio', { name: /settings/i }));
    await user.click(await screen.findByRole('checkbox', { name: 'Adobe Photoshop' }));
    await user.click(screen.getByRole('checkbox', { name: 'Visual Studio Code' }));

    await user.click(screen.getByRole('combobox', { name: /target for photoshop-capture/i }));
    await user.click(screen.getByRole('option', { name: 'photoshop-2025 · 26.0' }));
    await user.click(screen.getByRole('combobox', { name: /target for vscode-capture/i }));
    await user.click(screen.getByRole('option', { name: 'vscode-stable · 1.100' }));

    await user.click(screen.getByRole('checkbox', { name: 'Adobe Photoshop' }));
    await user.click(screen.getByTestId('setup-flow-apply'));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(profile, expect.objectContaining({
      restoreIntent: 'apps-and-settings',
      selectedModules: ['apps.vscode'],
      restoreTargets: [{
        captureId: 'vscode-capture',
        targetInstanceId: 'vscode-stable',
      }],
    })));
  });

  it('uses progress only while applying and renders final resolution state from the envelope', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      appEvents: [],
      restoreModulesAvailable: [{ id: 'photoshop', displayName: 'Adobe Photoshop' }],
    });
    let resolveApply!: (result: {
      installed: number;
      alreadyPresent: number;
      failed: number;
      skipped: number;
      appEvents: [];
      configResolutions: ConfigResolution[];
    }) => void;
    const onApply = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveApply = resolve;
    }));
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        onApply={onApply}
        liveConfigEvents={[{
          version: 1,
          event: 'config-migration',
          runId: 'run-1',
          timestamp: '2026-07-16T00:00:00Z',
          captureId: 'capture-1',
          configSetId: 'preferences',
          stage: 'commit',
          status: 'completed',
          reason: null,
          message: 'Transient migration completed',
          remediation: null,
        }]}
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    // Completed config resolutions render only under the settings intent, matching
    // the preview path gate, so opt into settings before applying.
    await user.click(screen.getByRole('radio', { name: /settings/i }));
    await waitFor(() => expect(onPreview).toHaveBeenNthCalledWith(2, profile, {
      restoreIntent: 'apps-and-settings',
    }));
    await screen.findByText('Preview complete');
    await user.click(screen.getByTestId('setup-flow-apply'));
    expect(await screen.findByText('Transient migration completed')).toBeInTheDocument();

    await act(async () => {
      resolveApply({
        installed: 1,
        alreadyPresent: 0,
        failed: 0,
        skipped: 0,
        appEvents: [],
        configResolutions: [configResolution({
          captureId: 'capture-1',
          resolution: 'migrate',
          label: 'Engine final result',
          status: 'rolled_back',
          message: 'Engine final rollback',
          remediation: 'Engine final remediation',
        })],
      });
    });

    expect(await screen.findByText('Engine final rollback')).toBeInTheDocument();
    expect(screen.getByText('rolled_back')).toBeInTheDocument();
    expect(screen.queryByText('Transient migration completed')).not.toBeInTheDocument();
  });

  it('renders no configuration cards for an install-only apply that carries resolution data', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      appEvents: [{ app: 'Vendor.Alpha', action: 'To install', name: 'Alpha package', timestamp: 1 }],
    });
    const onApply = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      failed: 0,
      skipped: 0,
      appEvents: [{ app: 'Vendor.Alpha', action: 'Installed', name: 'Alpha package', timestamp: 1 }],
      configResolutions: [
        configResolution({
          captureId: 'install-only-legacy',
          resolution: 'legacy_unverified',
          label: 'Compatibility unknown',
          message: 'Engine install-only leftover warning',
        }),
        configResolution({
          captureId: 'install-only-migrate',
          resolution: 'migrate',
          label: 'Will be upgraded',
          status: 'restored',
          message: 'Engine install-only migrate result',
        }),
      ],
    });
    const user = userEvent.setup();

    renderWithProviders(<SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />);

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    // Apply directly in the default apps-only intent.
    await user.click(screen.getByTestId('setup-flow-apply'));

    expect(await screen.findByText('Setup complete')).toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith(profile, undefined);
    expect(screen.queryByTestId('config-resolution-group-legacy_unverified')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-group-migrate')).not.toBeInTheDocument();
    expect(screen.queryByText('Engine install-only leftover warning')).not.toBeInTheDocument();
    expect(screen.queryByText('Engine install-only migrate result')).not.toBeInTheDocument();
  });

  it('renders structured engine error copy and remediation without rewriting either', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      appEvents: [],
    });
    const onApply = vi.fn().mockRejectedValue(new EngineEnvelopeError({
      code: 'config_generation_incompatible',
      message: 'Exact engine incompatibility message',
      remediation: 'Exact engine remediation',
    }));
    const user = userEvent.setup();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByText('generation-profile'));
    await screen.findByText('Preview complete');
    await user.click(screen.getByTestId('setup-flow-apply'));

    expect(await screen.findByText('Exact engine incompatibility message')).toBeInTheDocument();
    expect(screen.getByText('Exact engine remediation')).toBeInTheDocument();
  });
});
