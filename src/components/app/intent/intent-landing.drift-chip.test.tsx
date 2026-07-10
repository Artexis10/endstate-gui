import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { IntentLanding } from './intent-landing';

function renderLanding(
  overrides: Partial<React.ComponentProps<typeof IntentLanding>> = {},
) {
  return renderWithProviders(
    <IntentLanding onSelectSave={vi.fn()} onSelectSetup={vi.fn()} {...overrides} />,
  );
}

describe('IntentLanding drift chip', () => {
  it('renders no chip when the schedule never ran (props absent)', () => {
    renderLanding();
    expect(screen.queryByTestId('drift-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drift-check-failing-chip')).not.toBeInTheDocument();
  });

  it('renders no chip on a clean run (driftCount 0)', () => {
    renderLanding({ driftCount: 0, driftCheckedAt: '2026-07-10T09:00:00Z' });
    expect(screen.queryByTestId('drift-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drift-check-failing-chip')).not.toBeInTheDocument();
  });

  it('renders the amber drift chip with a pluralised count', () => {
    renderLanding({ driftCount: 3, driftCheckedAt: '2026-07-10T09:00:00Z' });
    expect(screen.getByTestId('drift-chip')).toHaveTextContent(
      '3 apps drifted since your snapshot',
    );
  });

  it('uses the singular form for one drifted app', () => {
    renderLanding({ driftCount: 1 });
    expect(screen.getByTestId('drift-chip')).toHaveTextContent(
      '1 app drifted since your snapshot',
    );
  });

  it('renders the muted failing chip when the last check failed', () => {
    renderLanding({ driftCheckFailing: true });
    expect(screen.getByTestId('drift-check-failing-chip')).toHaveTextContent(
      'Drift check failing',
    );
    expect(screen.queryByTestId('drift-chip')).not.toBeInTheDocument();
  });

  it('drift takes precedence over the "Scan complete" session chip', () => {
    renderLanding({ driftCount: 2, saveHasSession: true });
    expect(screen.getByTestId('drift-chip')).toBeInTheDocument();
    expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
  });

  it('drift takes precedence over a failing indicator', () => {
    renderLanding({ driftCount: 2, driftCheckFailing: true });
    expect(screen.getByTestId('drift-chip')).toBeInTheDocument();
    expect(screen.queryByTestId('drift-check-failing-chip')).not.toBeInTheDocument();
  });

  it('keeps the existing "Scan complete" chip when no drift props are set', () => {
    renderLanding({ saveHasSession: true });
    expect(screen.getByText('Scan complete')).toBeInTheDocument();
  });
});
