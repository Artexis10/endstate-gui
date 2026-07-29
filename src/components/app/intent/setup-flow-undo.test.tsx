import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';
import type { EndstateEnvelope, EndstateRevertData } from '../../../types';
import type { EngineExecResult } from '../../../lib/engine-exec';

function makeRevertResult(
  overrides?: Partial<EndstateRevertData>,
): EngineExecResult<EndstateEnvelope<EndstateRevertData>> {
  return {
    success: true,
    envelope: {
      schemaVersion: '1.0',
      cliVersion: 'test-1.0',
      command: 'revert',
      runId: 'test-run-123',
      timestampUtc: new Date().toISOString(),
      success: true,
      data: {
        dryRun: false,
        revertedRestoreRunId: 'restore-run-abc',
        revertCount: 3,
        skipCount: 0,
        failCount: 0,
        backupLocation: 'C:\\Users\\test\\.endstate\\backups\\def456',
        results: [
          { id: 'r1', targetPath: 'C:\\Users\\test\\AppData\\Roaming\\vscode\\settings.json', type: 'revert', status: 'reverted', reason: null },
          { id: 'r2', targetPath: 'C:\\Users\\test\\.gitconfig', type: 'revert', status: 'reverted', reason: null },
          { id: 'r3', targetPath: 'C:\\Users\\test\\Documents\\PowerShell\\profile.ps1', type: 'revert', status: 'reverted', reason: null },
        ],
        ...overrides,
      },
      error: null,
    },
    stdout: '',
    stderr: '',
    exitCode: 0,
  };
}

function makeErrorResult(message: string): EngineExecResult<EndstateEnvelope<EndstateRevertData>> {
  return {
    success: false,
    error: {
      kind: 'command_failed',
      message,
    },
  };
}

function makeNoHistoryResult(): EngineExecResult<EndstateEnvelope<EndstateRevertData>> {
  return makeRevertResult({
    revertedRestoreRunId: null,
    revertCount: 0,
    skipCount: 0,
    failCount: 0,
    results: [],
  });
}

const baseProps = {
  profiles: [],
  onBack: vi.fn(),
  onOpenProfilesFolder: vi.fn(),
  onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
  onFileDrop: vi.fn(),
  onDeleteProfile: vi.fn(),
  isRunning: false,
  setupProgress: null,
  liveAppEvents: [],
  onPreview: vi.fn(),
  onApply: vi.fn(),
};

describe('SetupFlow — Undo settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Undo changes" button in browse toolbar when undo props provided', () => {
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onUndoDryRun={vi.fn().mockReturnValue(new Promise(() => {}))}
        onUndoExecute={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /undo changes/i })).toBeInTheDocument();
  });

  it('does not show "Undo changes" button when no undo props', () => {
    renderWithProviders(<SetupFlow {...baseProps} />);

    expect(screen.queryByRole('button', { name: /undo changes/i })).not.toBeInTheDocument();
  });

  it('shows undo-checking phase when Undo changes is clicked', async () => {
    const onDryRun = vi.fn().mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <SetupFlow {...baseProps} onUndoDryRun={onDryRun} onUndoExecute={vi.fn()} />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByText('Checking for recent changes...')).toBeInTheDocument();
    });
    expect(onDryRun).toHaveBeenCalledTimes(1);
  });

  it('shows undo-confirm with file list when dry-run succeeds', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeRevertResult({ dryRun: true }));

    renderWithProviders(
      <SetupFlow {...baseProps} onUndoDryRun={onDryRun} onUndoExecute={vi.fn()} />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByText('Undo settings changes')).toBeInTheDocument();
    });

    // File count in subtitle
    expect(screen.getByText(/3 settings will be restored/i)).toBeInTheDocument();

    // File names visible
    expect(screen.getByText('settings.json')).toBeInTheDocument();
    expect(screen.getByText('.gitconfig')).toBeInTheDocument();
    expect(screen.getByText('profile.ps1')).toBeInTheDocument();

    // Buttons
    expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows undo-empty when no history found', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeNoHistoryResult());

    renderWithProviders(
      <SetupFlow {...baseProps} onUndoDryRun={onDryRun} onUndoExecute={vi.fn()} />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByText('Nothing to undo')).toBeInTheDocument();
    });

    expect(screen.getByText(/no recent setup changes found/i)).toBeInTheDocument();
  });

  it('shows undo-error when dry-run fails', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeErrorResult('CLI not found'));

    renderWithProviders(
      <SetupFlow {...baseProps} onUndoDryRun={onDryRun} onUndoExecute={vi.fn()} />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    expect(screen.getByText('CLI not found')).toBeInTheDocument();
  });

  it('executes undo and shows undo-done on success', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeRevertResult({ dryRun: true }));
    const onExecute = vi.fn().mockResolvedValue(makeRevertResult());

    renderWithProviders(
      <SetupFlow {...baseProps} onUndoDryRun={onDryRun} onUndoExecute={onExecute} />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /^undo$/i }).click();

    await waitFor(() => {
      expect(screen.getByText('Changes undone')).toBeInTheDocument();
    });

    expect(screen.getByText(/3 settings restored successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  it('shows undo-error with counts on partial failure', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeRevertResult({ dryRun: true }));
    const onExecute = vi.fn().mockResolvedValue(makeRevertResult({
      revertCount: 2,
      skipCount: 0,
      failCount: 1,
    }));

    renderWithProviders(
      <SetupFlow {...baseProps} onUndoDryRun={onDryRun} onUndoExecute={onExecute} />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /^undo$/i }).click();

    await waitFor(() => {
      expect(screen.getByText(/completed with errors/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Undone')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('fires onUndoComplete callback on success', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeRevertResult({ dryRun: true }));
    const onExecute = vi.fn().mockResolvedValue(makeRevertResult());
    const onComplete = vi.fn();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onUndoDryRun={onDryRun}
        onUndoExecute={onExecute}
        onUndoComplete={onComplete}
      />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /^undo$/i }).click();

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ revertCount: 3 }),
      );
    });
  });

  it('auto-starts undo when pendingUndo is true', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeRevertResult({ dryRun: true }));
    const onConsumed = vi.fn();

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onUndoDryRun={onDryRun}
        onUndoExecute={vi.fn()}
        pendingUndo={true}
        onPendingUndoConsumed={onConsumed}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Undo settings changes')).toBeInTheDocument();
    });

    expect(onDryRun).toHaveBeenCalledTimes(1);
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it('returns to browse when back is clicked from undo phase', async () => {
    const onDryRun = vi.fn().mockResolvedValue(makeNoHistoryResult());

    renderWithProviders(
      <SetupFlow
        {...baseProps}
        profiles={[{ name: 'test', path: '/test', displayName: 'Test Profile' }]}
        onUndoDryRun={onDryRun}
        onUndoExecute={vi.fn()}
      />,
    );

    screen.getByRole('button', { name: /undo changes/i }).click();

    await waitFor(() => {
      expect(screen.getByText('Nothing to undo')).toBeInTheDocument();
    });

    screen.getByTestId('setup-flow-back').click();

    // Should be back in browse showing profiles
    await waitFor(() => {
      expect(screen.getByText('Test Profile')).toBeInTheDocument();
    });
  });
});
