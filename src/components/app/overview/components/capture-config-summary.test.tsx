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

  it('shows included configs with "Settings captured" heading', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsIncluded: ['vscode-extensions', 'terminal-settings'],
      })} />
    );
    const section = screen.getByTestId('config-included');
    expect(section).toHaveTextContent('Settings captured');
    expect(section).toHaveTextContent('vscode-extensions');
    expect(section).toHaveTextContent('terminal-settings');
  });

  it('shows skipped configs with "Settings skipped" heading', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsSkipped: ['browser-data'],
      })} />
    );
    const section = screen.getByTestId('config-skipped');
    expect(section).toHaveTextContent('Settings skipped');
    expect(section).toHaveTextContent('browser-data');
  });

  it('shows errored configs with "Settings errors" heading', () => {
    render(
      <CaptureConfigSummary actionResult={makeResult({
        outputFormat: 'zip',
        configsCaptureErrors: ['git-config'],
      })} />
    );
    const section = screen.getByTestId('config-errored');
    expect(section).toHaveTextContent('Settings errors');
    expect(section).toHaveTextContent('git-config');
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
    expect(screen.getByTestId('config-included')).toBeInTheDocument();
    expect(screen.getByTestId('config-skipped')).toBeInTheDocument();
    expect(screen.getByTestId('config-errored')).toBeInTheDocument();
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
