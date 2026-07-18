import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../../../test/test-utils';
import { SaveFlow } from './save-flow';

describe('SaveFlow capture progress', () => {
  it('renders fallback feedback immediately and preserves an engine stage when items arrive', () => {
    const onStartCapture = vi.fn(() => new Promise<never>(() => {}));
    const { rerender } = renderWithProviders(
      <SaveFlow
        onBack={vi.fn()}
        engineConnected
        isRunning={false}
        captureStage={null}
        liveAppEvents={[]}
        onStartCapture={onStartCapture}
        onSaveToFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    expect(screen.getByText('Starting capture…')).toBeInTheDocument();

    rerender(
      <SaveFlow
        onBack={vi.fn()}
        engineConnected
        isRunning
        captureStage="settings"
        liveAppEvents={[{ app: 'Mozilla.Firefox', action: 'present', statusKey: 'present', reason: 'detected' }]}
        onStartCapture={onStartCapture}
        onSaveToFile={vi.fn()}
      />,
    );

    expect(screen.getByText('Collecting app settings…')).toBeInTheDocument();
    expect(screen.getByText('Mozilla.Firefox')).toBeInTheDocument();
  });
});
