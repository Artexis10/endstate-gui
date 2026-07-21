import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import { SaveFlow, type SaveFlowProps } from './save-flow';

const captureResult = {
  count: 1,
  draftText: '{"version":1,"apps":[]}',
  apps: [{ id: 'Microsoft.PowerToys', name: 'PowerToys' }],
  outputPath: 'C:\\cache\\capture.zip',
  outputFormat: 'zip' as const,
};

const baseProps = {
  onBack: vi.fn(),
  engineConnected: true,
  isRunning: false,
  captureStage: null,
  liveAppEvents: [],
};

async function reachSaveFailure(
  onStartCapture: SaveFlowProps['onStartCapture'],
  onSaveToFile: SaveFlowProps['onSaveToFile'],
) {
  renderWithProviders(
    <SaveFlow
      {...baseProps}
      onStartCapture={onStartCapture}
      onSaveToFile={onSaveToFile}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /start scan/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /save file/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /save file/i }));
  await waitFor(() => expect(screen.getByText('disk full')).toBeInTheDocument());
}

describe('SaveFlow save errors', () => {
  it('labels a save error as Save failed', async () => {
    await reachSaveFailure(
      vi.fn().mockResolvedValue(captureResult),
      vi.fn().mockRejectedValue(new Error('disk full')),
    );

    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(screen.queryByText('Scan failed')).not.toBeInTheDocument();
  });

  it('retries save with the retained capture result without rescanning', async () => {
    const onStartCapture = vi.fn().mockResolvedValue(captureResult);
    const onSaveToFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce({ saved: true });
    await reachSaveFailure(onStartCapture, onSaveToFile);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(onSaveToFile).toHaveBeenCalledTimes(2));
    expect(onSaveToFile).toHaveBeenLastCalledWith(captureResult);
    expect(onStartCapture).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('Backup saved')).toBeInTheDocument());
  });
});
