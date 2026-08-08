import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, fireEvent } from '@/test/test-utils';
import { ContinuousProtectionSetting } from './continuous-protection-setting';

const noop = vi.fn();

function renderSetting(
  overrides: Partial<React.ComponentProps<typeof ContinuousProtectionSetting>> = {},
) {
  return renderWithProviders(
    <ContinuousProtectionSetting
      enabled={false}
      time="09:00"
      autoPush={false}
      autoPushAvailable={false}
      manifestAvailable
      onToggle={noop}
      onTimeChange={noop}
      onAutoPushToggle={noop}
      {...overrides}
    />,
  );
}

describe('ContinuousProtectionSetting', () => {
  it('reflects the enabled state on the main toggle', () => {
    renderSetting({ enabled: true });
    expect(
      screen.getByRole('switch', { name: /check this computer for drift daily/i }),
    ).toBeChecked();
  });

  it('calls onToggle with the toggled value (toggle IS the consent)', async () => {
    const onToggle = vi.fn();
    renderSetting({ onToggle });
    await userEvent.click(
      screen.getByRole('switch', { name: /check this computer for drift daily/i }),
    );
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('disables enabling and shows the hint when no saved capture exists', () => {
    renderSetting({ manifestAvailable: false });
    expect(
      screen.getByRole('switch', { name: /check this computer for drift daily/i }),
    ).toBeDisabled();
    expect(screen.getByTestId('continuous-protection-hint')).toHaveTextContent(
      'Save this computer first',
    );
  });

  it('still allows turning OFF when the saved capture went missing', () => {
    renderSetting({ enabled: true, manifestAvailable: false });
    expect(
      screen.getByRole('switch', { name: /check this computer for drift daily/i }),
    ).not.toBeDisabled();
  });

  it('defaults the check time to 09:00', () => {
    renderSetting();
    expect(screen.getByLabelText(/check at/i)).toHaveValue('09:00');
  });

  it('reports time changes via onTimeChange', () => {
    const onTimeChange = vi.fn();
    renderSetting({ onTimeChange });
    fireEvent.change(screen.getByLabelText(/check at/i), { target: { value: '21:30' } });
    expect(onTimeChange).toHaveBeenCalledWith('21:30');
  });

  it('hides the auto-push sub-toggle when unavailable', () => {
    renderSetting({ autoPushAvailable: false });
    expect(
      screen.queryByRole('switch', { name: /upload the saved setup to endstate cloud/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the auto-push sub-toggle only when available and forwards changes', async () => {
    const onAutoPushToggle = vi.fn();
    renderSetting({ autoPushAvailable: true, onAutoPushToggle });
    const sub = screen.getByRole('switch', {
      name: /upload the saved setup to endstate cloud/i,
    });
    expect(sub).not.toBeChecked();
    await userEvent.click(sub);
    expect(onAutoPushToggle).toHaveBeenCalledWith(true);
  });

  it('disables controls while busy', () => {
    renderSetting({ busy: true, autoPushAvailable: true });
    expect(
      screen.getByRole('switch', { name: /check this computer for drift daily/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: /upload the saved setup to endstate cloud/i }),
    ).toBeDisabled();
  });
});
