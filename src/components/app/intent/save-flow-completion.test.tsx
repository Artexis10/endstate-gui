import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import { SaveFlow, type SaveFlowProps } from './save-flow';

const captureResult = {
  count: 1,
  draftText: '{"version":2,"apps":[]}',
  apps: [{ id: 'VideoLAN.VLC', name: 'VLC media player' }],
  outputPath: 'C:\\cache\\capture.zip',
  outputFormat: 'zip' as const,
};

async function saveCapture(onSaveToFile: SaveFlowProps['onSaveToFile'], onBack = vi.fn()) {
  renderWithProviders(
    <SaveFlow
      onBack={onBack}
      engineConnected={true}
      isRunning={false}
      captureProgress={null}
      liveAppEvents={[]}
      onStartCapture={vi.fn().mockResolvedValue(captureResult)}
      onSaveToFile={onSaveToFile}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /start scan/i }));
  await screen.findByRole('button', { name: /save file/i });
  fireEvent.click(screen.getByRole('button', { name: /save file/i }));
  await screen.findByText('Backup saved');
}

describe('SaveFlow completion', () => {
  it('keeps a clear completion state with a primary path back home', async () => {
    const onBack = vi.fn();
    await saveCapture(
      vi.fn().mockResolvedValue({
        saved: true,
        path: 'C:\\Users\\test\\Downloads\\capture.zip',
      }),
      onBack,
    );

    expect(screen.getByText('C:\\Users\\test\\Downloads\\capture.zip')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start scan/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('can reveal the saved file location and save another copy', async () => {
    const savedPath = 'C:\\Users\\test\\Downloads\\capture.zip';
    const onSaveToFile = vi.fn().mockResolvedValue({ saved: true, path: savedPath });
    const onOpenSavedFolder = vi.fn();

    renderWithProviders(
      <SaveFlow
        onBack={vi.fn()}
        engineConnected={true}
        isRunning={false}
        captureProgress={null}
        liveAppEvents={[]}
        onStartCapture={vi.fn().mockResolvedValue(captureResult)}
        onSaveToFile={onSaveToFile}
        onOpenSavedFolder={onOpenSavedFolder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /start scan/i }));
    await screen.findByRole('button', { name: /save file/i });
    fireEvent.click(screen.getByRole('button', { name: /save file/i }));
    await screen.findByText('Backup saved');

    fireEvent.click(screen.getByRole('button', { name: /open folder/i }));
    expect(onOpenSavedFolder).toHaveBeenCalledWith(savedPath);

    fireEvent.click(screen.getByRole('button', { name: /save another copy/i }));
    await waitFor(() => expect(onSaveToFile).toHaveBeenCalledTimes(2));
  });
});
