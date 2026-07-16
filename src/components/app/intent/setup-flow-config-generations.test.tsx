import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
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

  it('keeps legacy consent unchecked and forwards only an explicit target mapping', async () => {
    const onPreview = vi.fn().mockResolvedValue({
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
    });
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
    expect(screen.getByText('Engine legacy warning')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /settings/i }));

    const legacyConsent = screen.getByRole('checkbox', { name: 'Adobe Photoshop' });
    expect(legacyConsent).not.toBeChecked();
    await user.click(legacyConsent);

    const targetSelector = screen.getByRole('combobox', { name: /target for ambiguous-capture/i });
    expect(targetSelector).toHaveAttribute('data-placeholder');
    await user.click(targetSelector);
    await user.click(screen.getByRole('option', { name: 'photoshop-2025 · 26.0' }));

    await user.click(screen.getByTestId('setup-flow-apply'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply).toHaveBeenCalledWith(profile, {
      restoreIntent: 'apps-and-settings',
      selectedModules: ['photoshop'],
      restoreTargets: [{
        captureId: 'ambiguous-capture',
        targetInstanceId: 'photoshop-2025',
      }],
    });
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
    await user.click(screen.getByRole('checkbox', { name: 'Adobe Photoshop' }));
    await user.click(screen.getByRole('checkbox', { name: 'Visual Studio Code' }));

    await user.click(screen.getByRole('combobox', { name: /target for photoshop-capture/i }));
    await user.click(screen.getByRole('option', { name: 'photoshop-2025 · 26.0' }));
    await user.click(screen.getByRole('combobox', { name: /target for vscode-capture/i }));
    await user.click(screen.getByRole('option', { name: 'vscode-stable · 1.100' }));

    await user.click(screen.getByRole('checkbox', { name: 'Adobe Photoshop' }));
    await user.click(screen.getByTestId('setup-flow-apply'));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(profile, {
      restoreIntent: 'apps-and-settings',
      selectedModules: ['apps.vscode'],
      restoreTargets: [{
        captureId: 'vscode-capture',
        targetInstanceId: 'vscode-stable',
      }],
    }));
  });

  it('uses progress only while applying and renders final resolution state from the envelope', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      installed: 1,
      alreadyPresent: 0,
      appEvents: [],
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
