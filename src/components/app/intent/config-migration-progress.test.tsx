import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import type { ConfigProgressEvent } from '@/lib/streaming-events';
import { ConfigMigrationProgress } from './config-migration-progress';

describe('ConfigMigrationProgress', () => {
  it('renders engine-authored migration and rollback messages in stream order', () => {
    const events: ConfigProgressEvent[] = [
      {
        version: 1,
        runId: 'run-1',
        timestamp: '2026-07-16T10:00:00Z',
        event: 'config-resolution',
        captureId: 'capture-1',
        moduleId: 'apps.photoshop',
        configSetId: 'preferences',
        targetCandidates: [],
        resolution: 'migrate',
        reason: null,
        migrationPath: ['g1', 'g2'],
        label: 'Engine resolution label',
        message: 'Engine resolution message',
        remediation: null,
      },
      {
        version: 1,
        runId: 'run-1',
        timestamp: '2026-07-16T10:00:01Z',
        event: 'config-migration',
        captureId: 'capture-1',
        configSetId: 'preferences',
        stage: 'commit',
        status: 'failed',
        reason: 'commit_failed',
        message: 'Engine commit failure',
        remediation: 'Engine commit remediation',
      },
      {
        version: 1,
        runId: 'run-1',
        timestamp: '2026-07-16T10:00:02Z',
        event: 'config-migration',
        captureId: 'capture-1',
        configSetId: 'preferences',
        stage: 'rollback',
        status: 'completed',
        reason: null,
        message: 'Engine rollback completed',
        remediation: null,
      },
    ];

    renderWithProviders(<ConfigMigrationProgress events={events} />);

    expect(screen.getAllByTestId('config-progress-message').map((node) => node.textContent)).toEqual([
      'Engine resolution message',
      'Engine commit failure',
      'Engine rollback completed',
    ]);
    expect(screen.getByText('Engine resolution label')).toBeInTheDocument();
    expect(screen.getByText('Engine commit remediation')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('folds resolutions that need nothing into one quiet line and keeps a row for the rest', () => {
    const resolutionEvent = (
      index: number,
      overrides: Partial<Extract<ConfigProgressEvent, { event: 'config-resolution' }>>,
    ): ConfigProgressEvent => ({
      version: 1,
      runId: 'run-1',
      timestamp: '2026-07-16T10:00:00Z',
      event: 'config-resolution',
      captureId: `capture-${index}`,
      moduleId: `apps.app${index}`,
      configSetId: 'legacy',
      targetCandidates: [],
      resolution: 'legacy_unverified',
      reason: null,
      migrationPath: [],
      label: 'Compatibility unknown',
      message: 'These settings predate compatibility checks.',
      remediation: 'Review the legacy settings.',
      ...overrides,
    });
    const events: ConfigProgressEvent[] = [
      // 24 legacy sets with no reason, 16 app sets and 7 Windows sets already up to date,
      // and 1 Windows set with no target: 48 modules, none of which needs the person.
      ...Array.from({ length: 24 }, (_, i) => resolutionEvent(i, {})),
      ...Array.from({ length: 16 }, (_, i) => resolutionEvent(24 + i, {
        reason: 'already_up_to_date',
        message: 'The target already has the desired settings.',
      })),
      ...Array.from({ length: 7 }, (_, i) => resolutionEvent(40 + i, {
        moduleId: `windows-settings.setting${i}`,
        reason: 'already_up_to_date',
        message: 'The target already has the desired settings.',
      })),
      resolutionEvent(47, {
        moduleId: 'windows-settings.setting7',
        resolution: 'unknown',
        reason: 'target_not_detected',
        message: 'No target instance was detected for these settings.',
      }),
      // Rows that stay: a target to choose, an incompatible set and a migration step.
      resolutionEvent(48, {
        resolution: 'unknown',
        reason: 'ambiguous_target_instance',
        label: 'Choose a target',
        message: 'More than one compatible target instance was detected.',
      }),
      resolutionEvent(49, {
        resolution: 'incompatible',
        reason: 'downgrade_unsupported',
        label: 'Not supported',
        message: 'Settings cannot be restored to an older generation.',
      }),
      resolutionEvent(50, { resolution: 'direct', label: 'Compatible', message: 'Compatible.' }),
      resolutionEvent(51, { resolution: 'direct', label: 'Compatible', message: 'Compatible.' }),
      {
        version: 1,
        runId: 'run-1',
        timestamp: '2026-07-16T10:00:02Z',
        event: 'config-migration',
        captureId: 'capture-49',
        configSetId: 'legacy',
        stage: 'commit',
        status: 'failed',
        reason: 'commit_failed',
        message: 'Engine commit failure',
        remediation: null,
      },
    ];

    renderWithProviders(<ConfigMigrationProgress events={events} />);

    // Rows: the ambiguous set, the incompatible set and the migration step.
    expect(screen.getAllByRole('listitem').map((item) => item.querySelector('[data-testid="config-progress-message"]')?.textContent)).toEqual([
      'More than one compatible target instance was detected.',
      'Settings cannot be restored to an older generation.',
      'Engine commit failure',
    ]);
    // One line for the 48 folded modules, counted from the events.
    const line = screen.getByTestId('config-progress-folded');
    expect(line).toHaveTextContent(
      'Compatibility not checked for 40 app settings and 8 Windows settings. 47 of them were saved before Endstate checked versions.',
    );
    // A screen reader hears the rows, not a count that changes with every event.
    expect(line.closest('[aria-live]')).toBeNull();
    // The confirmations share one muted label, and no folded label repeats.
    expect(screen.getAllByTestId('config-progress-direct').map((node) => node.textContent)).toEqual(['Compatible']);
    expect(screen.queryByText('Compatibility unknown', { selector: 'p.font-medium' })).not.toBeInTheDocument();
  });

  it('renders nothing when the run has no config progress', () => {
    const { container } = renderWithProviders(<ConfigMigrationProgress events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
