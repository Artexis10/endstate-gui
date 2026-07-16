import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import type { ConfigResolution } from '@/types';
import { useShowDetails } from '@/lib/use-show-details';
import { ConfigResolutionList } from './config-resolution-list';

vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false),
}));

function resolution(
  overrides: Partial<ConfigResolution> & Pick<ConfigResolution, 'captureId' | 'resolution' | 'label'>,
): ConfigResolution {
  return {
    moduleId: 'apps.photoshop',
    configSetId: 'preferences',
    targetCandidates: [],
    reason: null,
    migrationPath: [],
    resolvedTargets: [],
    status: 'planned',
    message: `Message for ${overrides.captureId}`,
    remediation: null,
    ...overrides,
  };
}

describe('ConfigResolutionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useShowDetails).mockReturnValue(false);
  });

  it('renders engine labels, messages, remediation, and statuses verbatim', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({ captureId: 'direct', resolution: 'direct', label: 'Compatible' }),
          resolution({ captureId: 'migrate', resolution: 'migrate', label: 'Will be upgraded' }),
          resolution({ captureId: 'unknown', resolution: 'unknown', label: 'Compatibility unknown' }),
          resolution({
            captureId: 'incompatible',
            resolution: 'incompatible',
            label: 'Not supported',
            status: 'rollback_failed',
            message: 'Engine terminal message',
            remediation: 'Engine remediation',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Compatible')).toBeInTheDocument();
    expect(screen.getByText('Will be upgraded')).toBeInTheDocument();
    expect(screen.getByText('Compatibility unknown')).toBeInTheDocument();
    expect(screen.getByText('Not supported')).toBeInTheDocument();
    expect(screen.getByText('Engine terminal message')).toBeInTheDocument();
    expect(screen.getByText('Engine remediation')).toBeInTheDocument();
    expect(screen.getByText('rollback_failed')).toBeInTheDocument();
  });

  it('offers engine candidates in input order with no default target', async () => {
    const onTargetMappingChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'ambiguous',
            resolution: 'unknown',
            label: 'Engine ambiguity label',
            reason: 'ambiguous_target_instance',
            targetCandidates: [
              {
                id: 'instance-z',
                moduleId: 'apps.photoshop',
                detectorId: 'photoshop-install',
                rawVersion: '25.0',
                normalizedVersion: '25.0.0',
                evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
                restoreModuleRevision: 'revision-restore',
              },
              {
                id: 'instance-a',
                moduleId: 'apps.photoshop',
                detectorId: 'photoshop-install',
                rawVersion: '26.0',
                normalizedVersion: '26.0.0',
                evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
                restoreModuleRevision: 'revision-restore',
              },
            ],
          }),
        ]}
        restoreTargetSupported
        targetMappings={[]}
        onTargetMappingChange={onTargetMappingChange}
      />,
    );

    const selector = screen.getByRole('combobox', { name: /target for ambiguous/i });
    expect(selector).toHaveAttribute('data-placeholder');

    await user.click(selector);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'instance-z · 25.0',
      'instance-a · 26.0',
    ]);

    await user.click(screen.getByRole('option', { name: 'instance-a · 26.0' }));
    expect(onTargetMappingChange).toHaveBeenCalledWith({
      captureId: 'ambiguous',
      targetInstanceId: 'instance-a',
    });
  });

  it('keeps portable provenance collapsed until details are requested', async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'provenance',
            resolution: 'migrate',
            label: 'Engine provenance label',
            sourceInstance: {
              id: 'source-instance',
              detectorId: 'photoshop-install',
              rawVersion: 'source-25.0',
              normalizedVersion: '25.0.0',
              evidence: { type: 'installed-app', ref: 'Source evidence' },
            },
            targetCandidates: [{
              id: 'target-instance',
              moduleId: 'apps.photoshop',
              detectorId: 'photoshop-install',
              rawVersion: 'target-26.0',
              normalizedVersion: '26.0.0',
              evidence: { type: 'installed-app', ref: 'Target evidence' },
              targetGeneration: 'g2',
              targetGenerationFingerprint: 'fingerprint-target',
              restoreModuleRevision: 'revision-restore',
            }],
            sourceGeneration: 'g1',
            sourceGenerationFingerprint: 'fingerprint-abc',
            targetGeneration: 'g2',
            migrationPath: ['g1', 'g2'],
            captureModuleRevision: 'revision-capture',
            restoreModuleRevision: 'revision-restore',
            reason: 'engine_reason',
          }),
        ]}
      />,
    );

    expect(screen.queryByText(/source-25\.0/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Configuration details' }));
    expect(screen.getByText(/source-25\.0/)).toBeInTheDocument();
    expect(screen.getByText(/target-26\.0/)).toBeInTheDocument();
    expect(screen.getByText('fingerprint-abc')).toBeInTheDocument();
    expect(screen.getByText(/fingerprint-target/)).toBeInTheDocument();
    expect(screen.getByText('["g1","g2"]')).toBeInTheDocument();
    expect(screen.getByText('revision-capture')).toBeInTheDocument();
    expect(screen.getByText('revision-restore')).toBeInTheDocument();
    expect(screen.getByText('engine_reason')).toBeInTheDocument();
  });

  it('keeps target selection dark when the engine does not advertise it', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'unsupported',
            resolution: 'unknown',
            label: 'Engine ambiguity stays visible',
            reason: 'ambiguous_target_instance',
            targetCandidates: [{
              id: 'candidate-1',
              moduleId: 'apps.photoshop',
              detectorId: 'photoshop-install',
              rawVersion: '1.0',
              normalizedVersion: '1.0.0',
              evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
              restoreModuleRevision: 'revision-restore',
            }],
          }),
        ]}
        restoreTargetSupported={false}
      />,
    );

    expect(screen.getByText('Engine ambiguity stays visible')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
