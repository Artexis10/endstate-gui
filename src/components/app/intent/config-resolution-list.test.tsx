import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';
import type { ConfigResolution, ConfigTargetCandidate } from '@/types';
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

function candidate(id: string, rawVersion: string): ConfigTargetCandidate {
  return {
    id,
    moduleId: 'apps.photoshop',
    detectorId: 'photoshop-install',
    rawVersion,
    normalizedVersion: `${rawVersion}.0`,
    evidence: { type: 'registry', appId: 'Adobe.Photoshop' },
    restoreModuleRevision: 'revision-restore',
  };
}

describe('ConfigResolutionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useShowDetails).mockReturnValue(false);
  });

  it('leads each group card with its own reason, not the shared label', () => {
    // Groups are keyed on (resolution, label, message), so several groups
    // routinely share one label. Heading them by label made every card read
    // "Compatibility unknown", with the only text telling them apart buried at
    // the bottom in muted copy.
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'legacy-a',
            resolution: 'unknown',
            label: 'Compatibility unknown',
            message: 'These settings predate compatibility checks.',
          }),
          resolution({
            captureId: 'collision-a',
            resolution: 'unknown',
            label: 'Compatibility unknown',
            message: 'This config set overlaps another selected restore target.',
          }),
        ]}
      />,
    );

    const headings = screen.getAllByText(
      /predate compatibility checks|overlaps another selected restore target/,
    );
    expect(headings).toHaveLength(2);
    // Each reason is the card headline, not a muted footnote.
    for (const heading of headings) {
      expect(heading.className).toContain('font-medium');
      expect(heading.className).not.toContain('text-muted-foreground');
    }
    // The shared label still appears once per card, as supporting context.
    expect(screen.getAllByText('Compatibility unknown')).toHaveLength(2);
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

  it('collapses same-verdict legacy sets into a single group card', () => {
    const resolutions = Array.from({ length: 10 }, (_, index) => resolution({
      captureId: `legacy-${index}`,
      moduleId: `apps.module${index}`,
      resolution: 'legacy_unverified',
      label: 'Compatibility unknown',
      message: 'Review these legacy settings before restoring them.',
      remediation: 'Engine legacy remediation',
    }));

    renderWithProviders(<ConfigResolutionList resolutions={resolutions} />);

    expect(screen.getAllByTestId('config-resolution-group-legacy_unverified')).toHaveLength(1);
    expect(screen.getByText('10 settings')).toBeInTheDocument();
    expect(screen.getAllByText('Compatibility unknown')).toHaveLength(1);
    expect(screen.getAllByText('Review these legacy settings before restoring them.')).toHaveLength(1);
    expect(screen.getAllByText('Engine legacy remediation')).toHaveLength(1);
  });

  it('keeps groups with distinct engine messages separate', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'legacy-a',
            moduleId: 'apps.a',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'First legacy reason',
          }),
          resolution({
            captureId: 'legacy-b',
            moduleId: 'apps.b',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Second legacy reason',
          }),
        ]}
      />,
    );

    expect(screen.getAllByTestId('config-resolution-group-legacy_unverified')).toHaveLength(2);
    expect(screen.getByText('First legacy reason')).toBeInTheDocument();
    expect(screen.getByText('Second legacy reason')).toBeInTheDocument();
  });

  it('renders ambiguous-target rows as individual decision cards, never grouped', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'amb-1',
            resolution: 'unknown',
            label: 'Choose a target',
            message: 'Same ambiguity message',
            reason: 'ambiguous_target_instance',
            targetCandidates: [candidate('t-1', '1.0'), candidate('t-2', '2.0')],
          }),
          resolution({
            captureId: 'amb-2',
            resolution: 'unknown',
            label: 'Choose a target',
            message: 'Same ambiguity message',
            reason: 'ambiguous_target_instance',
            targetCandidates: [candidate('t-3', '3.0')],
          }),
        ]}
        restoreTargetSupported
        onTargetMappingChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('config-resolution-amb-1')).toBeInTheDocument();
    expect(screen.getByTestId('config-resolution-amb-2')).toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-group-unknown')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('renders the direct resolution as a quiet line with no card chrome or status tag', () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'direct-1',
            resolution: 'direct',
            label: 'Compatible',
            message: 'Compatible with your setup',
            status: 'restored',
          }),
          resolution({
            captureId: 'direct-2',
            moduleId: 'apps.vscode',
            resolution: 'direct',
            label: 'Compatible',
            message: 'Compatible with your setup',
            status: 'restored',
          }),
        ]}
      />,
    );

    const quietLine = screen.getByTestId('config-resolution-group-direct');
    expect(quietLine.tagName).toBe('P');
    expect(screen.getAllByText('Compatible')).toHaveLength(1);
    expect(screen.queryByText('restored')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configuration details' })).not.toBeInTheDocument();
  });

  it('keeps the legacy warning at the top level, visible without opening a disclosure', async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'legacy-1',
            moduleId: 'apps.photoshop',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Engine legacy consent warning',
            remediation: 'Engine legacy remediation',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Engine legacy consent warning')).toBeVisible();
    expect(screen.getByText('Engine legacy remediation')).toBeVisible();
    expect(screen.getByText('Compatibility unknown')).toBeVisible();
    // Technical provenance (including the raw module id) stays behind the disclosure.
    expect(screen.queryByTestId('config-resolution-legacy-1')).not.toBeInTheDocument();
    expect(screen.queryByText('apps.photoshop')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configuration details' }));
    expect(screen.getByTestId('config-resolution-legacy-1')).toBeInTheDocument();
    expect(screen.getByText('apps.photoshop')).toBeInTheDocument();
  });

  it('keeps the raw module id out of the distilled group card', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'legacy-capture',
            moduleId: 'apps.photoshop',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Review these legacy settings before restoring them.',
          }),
        ]}
      />,
    );

    const card = screen.getByTestId('config-resolution-group-legacy_unverified');
    expect(within(card).queryByText('apps.photoshop')).not.toBeInTheDocument();
    expect(within(card).getByText('Review these legacy settings before restoring them.')).toBeVisible();
  });

  it('lists grouped member display names inside a single card', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'photoshop-legacy',
            moduleId: 'apps.photoshop',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Review these legacy settings before restoring them.',
          }),
          resolution({
            captureId: 'vscode-legacy',
            moduleId: 'apps.vscode',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Review these legacy settings before restoring them.',
          }),
        ]}
        moduleDisplayNames={{
          'apps.photoshop': 'Adobe Photoshop',
          'apps.vscode': 'Visual Studio Code',
        }}
      />,
    );

    const cards = screen.getAllByTestId('config-resolution-group-legacy_unverified');
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(within(card).getByText('Adobe Photoshop')).toBeVisible();
    expect(within(card).getByText('Visual Studio Code')).toBeVisible();
    expect(within(card).getByText('2 settings')).toBeVisible();
    expect(screen.queryByText('apps.photoshop')).not.toBeInTheDocument();
    expect(screen.queryByText('apps.vscode')).not.toBeInTheDocument();
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

  it('keeps grouped provenance collapsed until details are requested', async () => {
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

    expect(screen.queryByText('apps.photoshop')).not.toBeInTheDocument();
    expect(screen.queryByText(/source-25\.0/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Configuration details' }));
    expect(screen.getByTestId('config-resolution-provenance')).toBeInTheDocument();
    expect(screen.getByText('apps.photoshop')).toBeInTheDocument();
    expect(screen.getByText(/source-25\.0/)).toBeInTheDocument();
    expect(screen.getByText(/target-26\.0/)).toBeInTheDocument();
    expect(screen.getByText('fingerprint-abc')).toBeInTheDocument();
    expect(screen.getByText(/fingerprint-target/)).toBeInTheDocument();
    expect(screen.getByText('["g1","g2"]')).toBeInTheDocument();
    expect(screen.getByText('revision-capture')).toBeInTheDocument();
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
