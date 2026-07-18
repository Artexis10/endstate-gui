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

  it('renders nothing when the run has no config progress', () => {
    const { container } = renderWithProviders(<ConfigMigrationProgress events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
