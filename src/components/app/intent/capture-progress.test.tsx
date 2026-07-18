import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen } from '../../../test/test-utils';
import { CaptureProgress } from './capture-progress';

describe('CaptureProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows useful indeterminate feedback before the first engine stage', () => {
    renderWithProviders(<CaptureProgress stage={null} />);

    expect(screen.getByText('Starting capture…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Capture in progress' })).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('Elapsed 0s')).toBeInTheDocument();
  });

  it.each([
    ['inventory', 'Checking installed apps…'],
    ['settings', 'Collecting app settings…'],
    ['packaging', 'Packaging your setup…'],
  ] as const)('maps %s to GUI-owned stage copy', (stage, copy) => {
    renderWithProviders(<CaptureProgress stage={stage} />);
    expect(screen.getByText(copy)).toHaveAttribute('aria-live', 'polite');
  });

  it('shows elapsed time and the exact reassurance at eight seconds without announcing the timer', () => {
    renderWithProviders(<CaptureProgress stage="inventory" />);

    act(() => vi.advanceTimersByTime(8_000));

    expect(screen.getByText('Elapsed 8s')).not.toHaveAttribute('aria-live');
    expect(screen.getByText('Still working — your package manager can take 20 seconds or more on systems with many apps.')).toBeInTheDocument();
  });

  it('clears its elapsed timer when unmounted', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderWithProviders(<CaptureProgress stage={null} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
