/**
 * Recovery-key dialog — load-bearing contract §1 tests.
 *
 * What we pin here:
 *   - The Continue button is disabled until ≥ 2 save methods have been used.
 *   - The Copy save method counts.
 *   - The "Save to file" save method counts.
 *   - The temp file at `recoveryKeySavedTo` is removed on continue.
 *   - Pressing Escape does NOT close the dialog (no-escape-hatch invariant).
 *
 * The PDF path is exercised in a separate, narrower assertion to avoid
 * dragging a full jspdf dependency into the smoke tests.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { RecoveryKeyDialog } from './recovery-key-dialog';

const TWENTY_FOUR_WORDS = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(' ');

const invokeMock = vi.fn();
const saveDialogMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/tauri-bridge', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
  // Tests exercise the Tauri-runtime path (plugin-dialog + invoke). The
  // dialog has a separate browser-bridge fallback that uses Blob downloads;
  // not asserted here.
  isTauriRuntime: () => true,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: saveDialogMock,
}));

// jsPDF is invoked via `new jsPDF(...)`, so the mock has to be a real
// constructor. vi.fn() does not satisfy `new`. Class works.
vi.mock('jspdf', () => {
  return {
    default: class FakeJsPDF {
      internal = { pageSize: { getWidth: () => 612 } };
      setFont() {}
      setFontSize() {}
      text() {}
      output() {
        return 'data:application/pdf;base64,SGVsbG8gV29ybGQ=';
      }
    },
  };
});

beforeEach(() => {
  saveDialogMock.mockReset();
  saveDialogMock.mockResolvedValue('C:\\Users\\test\\Downloads\\recovery.txt');
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === 'read_text_file') return Promise.resolve(TWENTY_FOUR_WORDS);
    if (cmd === 'delete_file_silent') return Promise.resolve();
    if (cmd === 'write_text_file') return Promise.resolve();
    if (cmd === 'write_file_base64') return Promise.resolve();
    return Promise.resolve();
  });
  // jsdom doesn't ship a clipboard mock by default
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('RecoveryKeyDialog (load-bearing)', () => {
  it('reads the 24 words and renders them in a numbered grid', async () => {
    renderWithProviders(
      <RecoveryKeyDialog
        open
        recoveryKeySavedTo="C:\\Users\\test\\AppData\\Local\\Endstate\\cache\\captures\\recovery-1.txt"
        email="user@example.com"
        onContinue={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('recovery-key-grid')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('recovery-key-grid')).toHaveTextContent('word1');
    expect(screen.getByTestId('recovery-key-grid')).toHaveTextContent('word24');
    expect(screen.getByTestId('saves-progress')).toHaveTextContent('0 of 2');
  });

  it('disables the Continue button until two save methods are used', async () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <RecoveryKeyDialog
        open
        recoveryKeySavedTo="C:\\Users\\test\\recovery.txt"
        email="user@example.com"
        onContinue={onContinue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('recovery-key-grid')).toBeInTheDocument(),
    );
    const continueBtn = screen.getByTestId('recovery-key-continue');
    expect(continueBtn).toBeDisabled();

    // First save method — Copy
    await userEvent.click(screen.getByTestId('save-method-copy'));
    await waitFor(() =>
      expect(screen.getByTestId('save-method-copy')).toHaveAttribute('data-saved', 'true'),
    );
    expect(continueBtn).toBeDisabled();
    expect(screen.getByTestId('saves-progress')).toHaveTextContent('1 of 2');

    // Second save method — Save to file
    await userEvent.click(screen.getByTestId('save-method-save-to-file'));
    await waitFor(() =>
      expect(screen.getByTestId('save-method-save-to-file')).toHaveAttribute(
        'data-saved',
        'true',
      ),
    );
    expect(continueBtn).toBeEnabled();

    // Continue — temp file is cleaned up. Use a relaxed check on the
    // invoke call: the engine path may be normalised differently across
    // jsdom and Node, so just match the command name + path field.
    await userEvent.click(continueBtn);
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    const deleteCalls = invokeMock.mock.calls.filter(
      ([cmd]) => cmd === 'delete_file_silent',
    );
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0][1]).toMatchObject({
      path: expect.stringMatching(/recovery\.txt$/),
    });
  });

  it('counts the PDF save method', async () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <RecoveryKeyDialog
        open
        recoveryKeySavedTo="C:\\Users\\test\\recovery.txt"
        email="user@example.com"
        onContinue={onContinue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('recovery-key-grid')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId('save-method-save-as-pdf'));
    await waitFor(() =>
      expect(screen.getByTestId('save-method-save-as-pdf')).toHaveAttribute(
        'data-saved',
        'true',
      ),
    );
    // Verify the PDF write went through write_file_base64 (binary-safe path)
    expect(invokeMock).toHaveBeenCalledWith(
      'write_file_base64',
      expect.objectContaining({ dataBase64: expect.any(String) }),
    );
  });

  it('shows the pending native dialog and blocks duplicate export attempts', async () => {
    let finishDialog: (path: string | null) => void = () => {};
    saveDialogMock.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => {
        finishDialog = resolve;
      }),
    );

    renderWithProviders(
      <RecoveryKeyDialog
        open
        recoveryKeySavedTo="C:\\Users\\test\\recovery.txt"
        email="user@example.com"
        onContinue={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('recovery-key-grid')).toBeInTheDocument(),
    );

    const fileButton = screen.getByTestId('save-method-save-to-file');
    const pdfButton = screen.getByTestId('save-method-save-as-pdf');
    await userEvent.click(fileButton);

    expect(fileButton).toHaveTextContent('Opening...');
    expect(fileButton).toBeDisabled();
    expect(pdfButton).toBeDisabled();

    await userEvent.click(pdfButton);
    expect(saveDialogMock).toHaveBeenCalledTimes(1);

    finishDialog(null);
    await waitFor(() => expect(fileButton).toHaveTextContent('Save to file'));
    expect(fileButton).toBeEnabled();
    expect(pdfButton).toBeEnabled();
  });

  it('does not close on Escape (no-close-path invariant)', async () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <RecoveryKeyDialog
        open
        recoveryKeySavedTo="C:\\Users\\test\\recovery.txt"
        email="user@example.com"
        onContinue={onContinue}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('recovery-key-grid')).toBeInTheDocument(),
    );
    await userEvent.keyboard('{Escape}');
    // Dialog content remains in the DOM and onContinue is not invoked.
    expect(screen.getByTestId('recovery-key-grid')).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
  });
});
