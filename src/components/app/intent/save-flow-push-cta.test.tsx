import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../../test/test-utils';
import { SaveFlow } from './save-flow';

const baseProps = {
  onBack: vi.fn(),
  engineConnected: true,
  isRunning: false,
  captureStage: null,
  liveAppEvents: [],
  onSaveToFile: vi.fn().mockResolvedValue({ saved: true }),
};

const captureResult = {
  count: 2,
  draftText: '{}',
  apps: [
    { id: 'Mozilla.Firefox', name: 'Firefox' },
    { id: 'Microsoft.VisualStudioCode', name: 'VS Code' },
  ],
  outputPath: 'C:\\cache\\capture-123.jsonc',
  outputFormat: 'jsonc' as const,
};

async function reachDoneState() {
  // Start the capture and wait for the done card to render.
  fireEvent.click(screen.getByRole('button', { name: /start scan/i }));
  await waitFor(() =>
    expect(screen.getByTestId('save-flow-save-file')).toBeInTheDocument(),
  );
}

describe('SaveFlow — Push to hosted backup CTA', () => {
  it('does not render the push button when onPushToHostedBackup is undefined', async () => {
    renderWithProviders(
      <SaveFlow
        {...baseProps}
        onStartCapture={vi.fn().mockResolvedValue(captureResult)}
      />,
    );

    await reachDoneState();
    expect(screen.queryByTestId('save-flow-push-to-backup')).not.toBeInTheDocument();
  });

  it('renders the push button when onPushToHostedBackup is provided', async () => {
    const onPush = vi.fn();
    renderWithProviders(
      <SaveFlow
        {...baseProps}
        onStartCapture={vi.fn().mockResolvedValue(captureResult)}
        onPushToHostedBackup={onPush}
      />,
    );

    await reachDoneState();
    expect(screen.getByTestId('save-flow-push-to-backup')).toBeInTheDocument();
  });

  it('invokes onPushToHostedBackup with the captured output path on click', async () => {
    const onPush = vi.fn();
    renderWithProviders(
      <SaveFlow
        {...baseProps}
        onStartCapture={vi.fn().mockResolvedValue(captureResult)}
        onPushToHostedBackup={onPush}
      />,
    );

    await reachDoneState();
    fireEvent.click(screen.getByTestId('save-flow-push-to-backup'));
    expect(onPush).toHaveBeenCalledWith('C:\\cache\\capture-123.jsonc');
  });

  it('does not render the push button when the capture has no outputPath', async () => {
    const onPush = vi.fn();
    renderWithProviders(
      <SaveFlow
        {...baseProps}
        onStartCapture={vi.fn().mockResolvedValue({ ...captureResult, outputPath: undefined })}
        onPushToHostedBackup={onPush}
      />,
    );

    await reachDoneState();
    expect(screen.queryByTestId('save-flow-push-to-backup')).not.toBeInTheDocument();
  });

  // Auto-backup already covers this capture → the manual push is redundant and
  // must hide (the done-card shows the "Backing up…"/"Backed up" chip instead).
  it.each(['backing-up', 'backed-up'] as const)(
    'hides the push button when autoBackupState is "%s"',
    async (autoBackupState) => {
      renderWithProviders(
        <SaveFlow
          {...baseProps}
          onStartCapture={vi.fn().mockResolvedValue(captureResult)}
          onPushToHostedBackup={vi.fn()}
          autoBackupState={autoBackupState}
        />,
      );

      await reachDoneState();
      expect(screen.queryByTestId('save-flow-push-to-backup')).not.toBeInTheDocument();
    },
  );

  // Auto-backup did NOT handle this capture (off / not eligible / consent
  // pending → 'idle', or auth lost → 'paused') → manual push stays as fallback.
  it.each(['idle', 'paused'] as const)(
    'keeps the push button when autoBackupState is "%s"',
    async (autoBackupState) => {
      renderWithProviders(
        <SaveFlow
          {...baseProps}
          onStartCapture={vi.fn().mockResolvedValue(captureResult)}
          onPushToHostedBackup={vi.fn()}
          autoBackupState={autoBackupState}
        />,
      );

      await reachDoneState();
      expect(screen.getByTestId('save-flow-push-to-backup')).toBeInTheDocument();
    },
  );
});
