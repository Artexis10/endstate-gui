import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../../test/test-utils';
import { RestoreIntentToggle } from './restore-intent-toggle';

describe('RestoreIntentToggle', () => {
  const defaultProps = {
    restoreIntent: 'apps-only' as const,
    onRestoreIntentChange: vi.fn(),
    configModuleCount: 3,
  };

  it('renders when configModuleCount > 0', () => {
    renderWithProviders(<RestoreIntentToggle {...defaultProps} />);

    expect(screen.getByTestId('restore-intent-toggle')).toBeInTheDocument();
    expect(screen.getByText(/this profile includes settings for 3 apps/i)).toBeInTheDocument();
  });

  it('returns null when configModuleCount is 0', () => {
    const { container } = renderWithProviders(
      <RestoreIntentToggle {...defaultProps} configModuleCount={0} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders singular "app" for configModuleCount === 1', () => {
    renderWithProviders(
      <RestoreIntentToggle {...defaultProps} configModuleCount={1} />
    );

    expect(screen.getByText(/settings for 1 app$/i)).toBeInTheDocument();
  });

  it('renders both radio options', () => {
    renderWithProviders(<RestoreIntentToggle {...defaultProps} />);

    expect(screen.getByRole('radio', { name: /install apps only/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /install apps and restore settings/i })).toBeInTheDocument();
  });

  it('shows safety message when apps-and-settings is selected', () => {
    renderWithProviders(
      <RestoreIntentToggle {...defaultProps} restoreIntent="apps-and-settings" />
    );

    expect(screen.getByText(/backed up first/i)).toBeInTheDocument();
    expect(screen.getByText(/revert at any time/i)).toBeInTheDocument();
  });

  it('does not show safety message when apps-only is selected', () => {
    renderWithProviders(
      <RestoreIntentToggle {...defaultProps} restoreIntent="apps-only" />
    );

    expect(screen.queryByText(/backed up first/i)).not.toBeInTheDocument();
  });

  it('calls onRestoreIntentChange when radio is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <RestoreIntentToggle {...defaultProps} onRestoreIntentChange={onChange} />
    );

    const settingsRadio = screen.getByRole('radio', { name: /install apps and restore settings/i });
    settingsRadio.click();

    expect(onChange).toHaveBeenCalledWith('apps-and-settings');
  });

  it('defaults restore to OFF (apps-only checked)', () => {
    renderWithProviders(<RestoreIntentToggle {...defaultProps} />);

    const appsOnlyRadio = screen.getByRole('radio', { name: /install apps only/i });
    expect(appsOnlyRadio).toBeChecked();
  });
});
