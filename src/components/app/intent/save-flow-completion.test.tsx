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

const captureResultWithSettings = {
  count: 1,
  draftText: '{"version":2,"apps":[]}',
  apps: [{ id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code' }],
  outputPath: 'C:\\cache\\capture.zip',
  outputFormat: 'zip' as const,
  configsIncluded: ['apps.vscode', 'apps.cursor'],
  configModules: [
    {
      id: 'apps.vscode',
      appId: 'vscode',
      displayName: 'Visual Studio Code',
      status: 'captured' as const,
      filesCaptured: 3,
      wingetRefs: ['Microsoft.VisualStudioCode'],
    },
    {
      id: 'apps.cursor',
      appId: 'cursor',
      displayName: 'Cursor',
      status: 'captured' as const,
      filesCaptured: 2,
      wingetRefs: [],
    },
  ],
};

async function scanCapture() {
  renderWithProviders(
    <SaveFlow
      onBack={vi.fn()}
      engineConnected={true}
      isRunning={false}
      captureProgress={null}
      liveAppEvents={[]}
      onStartCapture={vi.fn().mockResolvedValue(captureResultWithSettings)}
      onSaveToFile={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /start scan/i }));
  await screen.findByText('Scan complete');
}

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
  it('labels installable inventory and explains that it is included for setup', async () => {
    await scanCapture();

    expect(screen.getByText('Apps found on this PC')).toBeInTheDocument();
    expect(screen.getByText(/included for setup/i)).toBeInTheDocument();
  });

  it('labels captured settings without implying installer ownership', async () => {
    await scanCapture();

    expect(screen.getByText('Settings captured')).toBeInTheDocument();
  });

  it('gives an installable app settings icon accessible meaning', async () => {
    await scanCapture();

    expect(screen.getByLabelText('Settings captured for this app')).toBeInTheDocument();
  });

  it('separates settings-only entries with explicit installer ownership', async () => {
    await scanCapture();

    expect(screen.getByText('Settings only — app installation not included')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        /Endstate.*captured.*settings/i.test(content)
        && /backup.*does not include.*app installer/i.test(content),
      ),
    ).toBeInTheDocument();
  });

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

  it('keeps the saved completion state when a second save is cancelled', async () => {
    const onSaveToFile = vi
      .fn()
      .mockResolvedValueOnce({ saved: true, path: 'C:\\Users\\test\\Downloads\\capture.zip' })
      .mockResolvedValueOnce({ saved: false });

    await saveCapture(onSaveToFile);
    fireEvent.click(screen.getByRole('button', { name: /save another copy/i }));

    await waitFor(() => expect(onSaveToFile).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Backup saved')).toBeInTheDocument();
    expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
  });

  it('returns to the saved completion after a failed second save is retried and cancelled', async () => {
    const firstSavedPath = 'C:\\Users\\test\\Downloads\\capture.zip';
    const onSaveToFile = vi
      .fn()
      .mockResolvedValueOnce({ saved: true, path: firstSavedPath })
      .mockRejectedValueOnce(new Error('The destination is unavailable'))
      .mockResolvedValueOnce({ saved: false });

    await saveCapture(onSaveToFile);
    fireEvent.click(screen.getByRole('button', { name: /save another copy/i }));

    await screen.findByText('Save failed');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(onSaveToFile).toHaveBeenCalledTimes(3));
    expect(screen.getByText('Backup saved')).toBeInTheDocument();
    expect(screen.getByText(firstSavedPath)).toBeInTheDocument();
    expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
  });
});
