import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureConfigSummary } from './capture-config-summary';
import type { ActionResult } from '../types';

function makeResult(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    action: 'capture',
    status: 'success',
    summary: '3 apps captured',
    ...overrides,
  };
}

describe('CaptureConfigSummary', () => {
  it('renders nothing when outputFormat is not zip', () => {
    const { container } = render(
      <CaptureConfigSummary actionResult={makeResult({ outputFormat: 'jsonc' })} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when outputFormat is undefined', () => {
    const { container } = render(
      <CaptureConfigSummary actionResult={makeResult()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "No app settings captured" when zip but all arrays empty', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsIncluded: [],
        configsSkipped: [],
        configsCaptureErrors: [],
      })} />
    );
    expect(screen.getByTestId('config-none')).toHaveTextContent('No app settings captured');
  });

  it('shows included configs as rows with "Captured" badge', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsIncluded: ['vscode-extensions', 'terminal-settings'],
      })} />
    );
    const rows = screen.getAllByTestId('config-included');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('vscode-extensions');
    expect(rows[0]).toHaveTextContent('Captured');
    expect(rows[1]).toHaveTextContent('terminal-settings');
  });

  it('shows skipped configs as rows with "Skipped" badge', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsSkipped: ['browser-data'],
      })} />
    );
    const rows = screen.getAllByTestId('config-skipped');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('browser-data');
    expect(rows[0]).toHaveTextContent('Skipped');
  });

  it('shows errored configs as rows with "Error" badge', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsCaptureErrors: ['git-config'],
      })} />
    );
    const rows = screen.getAllByTestId('config-errored');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('git-config');
    expect(rows[0]).toHaveTextContent('Error');
  });

  it('shows all three sections when mixed results', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsIncluded: ['vscode-extensions'],
        configsSkipped: ['browser-data'],
        configsCaptureErrors: ['git-config'],
      })} />
    );
    expect(screen.getAllByTestId('config-included')).toHaveLength(1);
    expect(screen.getAllByTestId('config-skipped')).toHaveLength(1);
    expect(screen.getAllByTestId('config-errored')).toHaveLength(1);
    expect(screen.queryByTestId('config-none')).not.toBeInTheDocument();
  });

  it('does not show "No app settings" when at least one config exists', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsIncluded: ['vscode-extensions'],
      })} />
    );
    expect(screen.queryByTestId('config-none')).not.toBeInTheDocument();
  });
});
