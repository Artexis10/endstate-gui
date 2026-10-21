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

  it('folds same-verdict legacy sets into one quiet line, never a card', () => {
    const resolutions = Array.from({ length: 10 }, (_, index) => resolution({
      captureId: `legacy-${index}`,
      moduleId: `apps.module${index}`,
      resolution: 'legacy_unverified',
      label: 'Compatibility unknown',
      message: 'Review these legacy settings before restoring them.',
      remediation: 'Engine legacy remediation',
    }));

    renderWithProviders(<ConfigResolutionList resolutions={resolutions} />);

    const section = screen.getByRole('region', { name: 'Settings compatibility' });
    expect(section.children).toHaveLength(1);
    expect(screen.queryByTestId('config-resolution-group-legacy_unverified')).not.toBeInTheDocument();
    expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
      'Compatibility not checked for 10 settings. They were saved before Endstate checked versions.',
    );
    // The engine copy lives behind the details disclosure, which is off here.
    expect(screen.queryByText('Review these legacy settings before restoring them.')).not.toBeInTheDocument();
  });

  it('lists each engine message once in details, grouped, with its label shown once', async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'legacy-a',
            moduleId: 'apps.a',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'First legacy reason',
            remediation: 'Shared remediation',
          }),
          resolution({
            captureId: 'legacy-b',
            moduleId: 'apps.b',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Second legacy reason',
          }),
          resolution({
            captureId: 'legacy-c',
            moduleId: 'apps.c',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'First legacy reason',
            remediation: 'Shared remediation',
          }),
        ]}
        moduleDisplayNames={{ 'apps.a': 'App A', 'apps.b': 'App B', 'apps.c': 'App C' }}
      />,
    );

    expect(screen.getAllByTestId('config-resolution-folded')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Configuration details' }));

    expect(screen.getAllByText('First legacy reason')).toHaveLength(1);
    expect(screen.getAllByText('Second legacy reason')).toHaveLength(1);
    expect(screen.getAllByText('Shared remediation')).toHaveLength(1);
    expect(screen.getAllByText('Compatibility unknown')).toHaveLength(1);
    for (const name of ['App A', 'App B', 'App C']) {
      expect(screen.getAllByText(name)).toHaveLength(1);
    }
  });

  describe('which resolutions fold into the quiet line', () => {
    type Case = {
      name: string;
      overrides: Partial<ConfigResolution>;
    };
    const base = { captureId: 'one', label: 'Engine label' };

    const folded: Case[] = [
      { name: 'legacy_unverified with no reason', overrides: { resolution: 'legacy_unverified' } },
      {
        name: 'legacy_unverified that is already up to date',
        overrides: { resolution: 'legacy_unverified', reason: 'already_up_to_date' },
      },
      { name: 'unknown with target_not_detected', overrides: { resolution: 'unknown', reason: 'target_not_detected' } },
      { name: 'unknown with already_up_to_date', overrides: { resolution: 'unknown', reason: 'already_up_to_date' } },
      { name: 'unknown with restore_filtered', overrides: { resolution: 'unknown', reason: 'restore_filtered' } },
      { name: 'unknown with restore_not_enabled', overrides: { resolution: 'unknown', reason: 'restore_not_enabled' } },
    ];
    const cards: Case[] = [
      { name: 'incompatible', overrides: { resolution: 'incompatible', reason: 'downgrade_unsupported' } },
      { name: 'migrate', overrides: { resolution: 'migrate' } },
      { name: 'unknown with target_collision', overrides: { resolution: 'unknown', reason: 'target_collision' } },
      { name: 'unknown with payload_integrity_failed', overrides: { resolution: 'unknown', reason: 'payload_integrity_failed' } },
      { name: 'unknown with a reason the GUI has never seen', overrides: { resolution: 'unknown', reason: 'a_future_reason' } },
      { name: 'unknown with no reason', overrides: { resolution: 'unknown', reason: null } },
      { name: 'legacy_unverified that failed', overrides: { resolution: 'legacy_unverified', status: 'failed' } },
      { name: 'legacy_unverified that rolled back', overrides: { resolution: 'legacy_unverified', status: 'rolled_back' } },
      { name: 'unknown and allowlisted that failed', overrides: { resolution: 'unknown', reason: 'target_not_detected', status: 'rollback_failed' } },
    ];

    it.each(folded)('folds $name', ({ overrides }) => {
      renderWithProviders(
        <ConfigResolutionList resolutions={[resolution({ ...base, resolution: 'unknown', ...overrides })]} />,
      );

      expect(screen.getByTestId('config-resolution-folded')).toBeInTheDocument();
      expect(screen.queryByTestId(/^config-resolution-group-/)).not.toBeInTheDocument();
    });

    it.each(cards)('shows $name as a card', ({ overrides }) => {
      renderWithProviders(
        <ConfigResolutionList resolutions={[resolution({ ...base, resolution: 'unknown', ...overrides })]} />,
      );

      expect(screen.getByTestId(`config-resolution-group-${overrides.resolution}`)).toBeInTheDocument();
      expect(screen.queryByTestId('config-resolution-folded')).not.toBeInTheDocument();
    });

    it('shows a failed direct result as a card, not a quiet confirmation', () => {
      renderWithProviders(
        <ConfigResolutionList
          resolutions={[
            resolution({ captureId: 'ok', resolution: 'direct', label: 'Compatible', status: 'restored' }),
            resolution({ captureId: 'bad', resolution: 'direct', label: 'Compatible', status: 'failed' }),
          ]}
        />,
      );

      // Only the failed result is a card; the successful one stays a quiet line.
      expect(screen.getByRole('article')).toHaveTextContent('failed');
      expect(screen.getAllByTestId('config-resolution-group-direct')).toHaveLength(2);
    });
  });

  it('never folds a row that asks the person to pick a target, whatever its kind', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'pick-me',
            resolution: 'legacy_unverified',
            label: 'Choose a target',
            reason: 'ambiguous_target_instance',
            targetCandidates: [candidate('t-1', '1.0')],
          }),
        ]}
        restoreTargetSupported
        onTargetMappingChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('config-resolution-pick-me')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-folded')).not.toBeInTheDocument();
  });

  it('keeps cards for what needs the person and puts the quiet line after them', () => {
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({ captureId: 'legacy', moduleId: 'apps.a', resolution: 'legacy_unverified', label: 'Compatibility unknown' }),
          resolution({
            captureId: 'bad',
            moduleId: 'apps.b',
            resolution: 'incompatible',
            label: 'Not supported',
            message: 'Cannot restore these settings',
          }),
        ]}
      />,
    );

    const section = screen.getByRole('region', { name: 'Settings compatibility' });
    expect(section.children).toHaveLength(2);
    expect(section.children[0]).toHaveAttribute('data-testid', 'config-resolution-group-incompatible');
    expect(section.children[1]).toHaveAttribute('data-testid', 'config-resolution-folded');
  });

  describe('the quiet line copy, counted from the data', () => {
    const legacy = (captureId: string, moduleId: string, overrides: Partial<ConfigResolution> = {}) =>
      resolution({ captureId, moduleId, resolution: 'legacy_unverified', label: 'Compatibility unknown', ...overrides });

    it('counts distinct modules, not config sets', () => {
      renderWithProviders(
        <ConfigResolutionList
          resolutions={[
            legacy('a-1', 'apps.a'),
            legacy('a-2', 'apps.a', { configSetId: 'other' }),
            legacy('b-1', 'apps.b'),
          ]}
        />,
      );

      expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
        'Compatibility not checked for 2 settings.',
      );
    });

    it('names app settings and Windows settings apart', () => {
      renderWithProviders(
        <ConfigResolutionList
          resolutions={[
            legacy('a', 'apps.a'),
            legacy('b', 'apps.b'),
            legacy('k', 'windows-settings.keyboard'),
          ]}
        />,
      );

      expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
        'Compatibility not checked for 2 app settings and 1 Windows setting. They were saved before Endstate checked versions.',
      );
    });

    it('says "It was" for one setting', () => {
      renderWithProviders(<ConfigResolutionList resolutions={[legacy('a', 'apps.a')]} />);

      expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
        'Compatibility not checked for 1 setting. It was saved before Endstate checked versions.',
      );
    });

    it('claims the legacy reason only for the legacy settings when others are folded too', () => {
      renderWithProviders(
        <ConfigResolutionList
          resolutions={[
            legacy('a', 'apps.a'),
            legacy('b', 'apps.b'),
            resolution({
              captureId: 'c',
              moduleId: 'apps.c',
              resolution: 'unknown',
              reason: 'target_not_detected',
              label: 'Compatibility unknown',
            }),
          ]}
        />,
      );

      expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
        'Compatibility not checked for 3 settings. 2 of them were saved before Endstate checked versions.',
      );
    });

    it('makes no claim about when the settings were saved when none is legacy', () => {
      renderWithProviders(
        <ConfigResolutionList
          resolutions={[
            resolution({
              captureId: 'c',
              moduleId: 'apps.c',
              resolution: 'unknown',
              reason: 'target_not_detected',
              label: 'Compatibility unknown',
            }),
          ]}
        />,
      );

      expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
        /^Compatibility not checked for 1 setting\.$/,
      );
    });
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

  it('keeps the folded notice visible and the engine copy and provenance behind the disclosure', async () => {
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

    // The notice itself is visible before any interaction.
    expect(screen.getByTestId('config-resolution-folded')).toHaveTextContent(
      'Compatibility not checked for 1 setting.',
    );
    expect(screen.queryByText('Engine legacy consent warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-resolution-legacy-1')).not.toBeInTheDocument();
    expect(screen.queryByText('apps.photoshop')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configuration details' }));
    expect(screen.getByText('Engine legacy consent warning')).toBeVisible();
    expect(screen.getByText('Engine legacy remediation')).toBeVisible();
    expect(screen.getByText('Compatibility unknown')).toBeVisible();
    expect(screen.getByTestId('config-resolution-legacy-1')).toBeInTheDocument();
    expect(screen.getByText('apps.photoshop')).toBeInTheDocument();
  });

  it('keeps the raw module id out of the quiet line', () => {
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

    const line = screen.getByTestId('config-resolution-folded');
    expect(within(line).queryByText('apps.photoshop')).not.toBeInTheDocument();
    expect(line).not.toHaveTextContent('apps.photoshop');
  });

  it('names each folded setting by its display name in details, with its status', async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(
      <ConfigResolutionList
        resolutions={[
          resolution({
            captureId: 'photoshop-legacy',
            moduleId: 'apps.photoshop',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Review these legacy settings before restoring them.',
            status: 'planned',
          }),
          resolution({
            captureId: 'vscode-legacy',
            moduleId: 'apps.vscode',
            resolution: 'legacy_unverified',
            label: 'Compatibility unknown',
            message: 'Review these legacy settings before restoring them.',
            status: 'skipped',
          }),
        ]}
        moduleDisplayNames={{
          'apps.photoshop': 'Adobe Photoshop',
          'apps.vscode': 'Visual Studio Code',
        }}
      />,
    );

    expect(screen.queryByText('Adobe Photoshop')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Configuration details' }));
    const photoshop = screen.getByTestId('config-resolution-photoshop-legacy');
    expect(within(photoshop).getByText('Adobe Photoshop')).toBeVisible();
    expect(within(photoshop).getByText('planned')).toBeVisible();
    const vscode = screen.getByTestId('config-resolution-vscode-legacy');
    expect(within(vscode).getByText('Visual Studio Code')).toBeVisible();
    expect(within(vscode).getByText('skipped')).toBeVisible();
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
