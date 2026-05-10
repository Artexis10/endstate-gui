/**
 * Recovery-key generation/presentation/verification dialog.
 *
 * **Load-bearing per Hosted Backup contract §1**: this dialog is the only
 * thing standing between a user who skips saving the recovery key and
 * permanent data loss when they forget their passphrase. The contract
 * mandate is:
 *
 *   - At least two save methods must be used before the user can continue
 *   - The user CANNOT dismiss the dialog without completing two saves
 *
 * Implementation specifics:
 *
 *   - Uses Radix `DialogPrimitive` directly (not the shared `DialogContent`
 *     wrapper) because the wrapper renders an X close button that we must
 *     not show.
 *   - `onEscapeKeyDown` and `onPointerDownOutside` are both prevented.
 *   - On Continue, the engine's temp recovery file at `recoveryKeySavedTo`
 *     is deleted via the existing `delete_file_silent` Tauri command.
 *
 * If you ever feel tempted to add an escape hatch to "be nicer" — don't.
 * The trust model is structural: there is no Endstate-side recovery if both
 * passphrase and key are lost. See contract §1 and §6.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri-bridge';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import jsPDF from 'jspdf';
import { Copy, Download, FileText, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export interface RecoveryKeyDialogProps {
  open: boolean;
  /** Engine-written temp file containing the 24-word mnemonic. */
  recoveryKeySavedTo: string;
  email: string;
  /** Called once the user has used 2+ save methods and clicked Continue. */
  onContinue: () => void;
}

const REQUIRED_SAVES = 2;
const TOTAL_WORDS = 24;

export function RecoveryKeyDialog({
  open,
  recoveryKeySavedTo,
  email,
  onContinue,
}: RecoveryKeyDialogProps) {
  const { showToast } = useToast();
  const [words, setWords] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedFile, setSavedFile] = useState(false);
  const [savedPdf, setSavedPdf] = useState(false);
  const [savedClipboard, setSavedClipboard] = useState(false);
  const [continuing, setContinuing] = useState(false);

  // Load mnemonic from engine's temp file
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const content = await invoke<string>('read_text_file', {
          path: recoveryKeySavedTo,
        });
        if (cancelled) return;
        const parsed = content
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        if (parsed.length !== TOTAL_WORDS) {
          setLoadError(
            `Expected ${TOTAL_WORDS} words, got ${parsed.length}. Contact support before retrying.`,
          );
          return;
        }
        setWords(parsed);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? `Could not read recovery key: ${err.message}`
            : 'Could not read recovery key file.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recoveryKeySavedTo]);

  const savesUsed = useMemo(
    () => Number(savedFile) + Number(savedPdf) + Number(savedClipboard),
    [savedFile, savedPdf, savedClipboard],
  );
  const canContinue = savesUsed >= REQUIRED_SAVES && !continuing;

  const wordsJoined = useMemo(() => words.join(' '), [words]);

  const handleSaveFile = useCallback(async () => {
    if (words.length !== TOTAL_WORDS) return;
    try {
      const target = await saveDialog({
        title: 'Save recovery key',
        defaultPath: 'endstate-recovery-key.txt',
        filters: [{ name: 'Text', extensions: ['txt'] }],
      });
      if (!target) return; // user cancelled
      await invoke('write_text_file', { path: target, content: wordsJoined + '\n' });
      setSavedFile(true);
      showToast('Recovery key saved to file', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? `Save failed: ${err.message}` : 'Save failed',
        'error',
      );
    }
  }, [words, wordsJoined, showToast]);

  const handleSavePdf = useCallback(async () => {
    if (words.length !== TOTAL_WORDS) return;
    try {
      const target = await saveDialog({
        title: 'Save recovery key as PDF',
        defaultPath: 'endstate-recovery-key.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!target) return;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Endstate recovery key', pageWidth / 2, 60, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`Account: ${email}`, pageWidth / 2, 84, { align: 'center' });
      doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, pageWidth / 2, 102, {
        align: 'center',
      });

      // 4 columns x 6 rows numbered grid
      const startY = 160;
      const colWidth = (pageWidth - 120) / 4;
      const rowHeight = 30;
      doc.setFont('courier', 'normal');
      doc.setFontSize(13);
      for (let i = 0; i < TOTAL_WORDS; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 60 + col * colWidth;
        const y = startY + row * rowHeight;
        const numberLabel = String(i + 1).padStart(2, '0');
        doc.text(`${numberLabel}. ${words[i]}`, x, y);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(
        'Save this somewhere safe. If you forget your passphrase, this is the only way back in. Endstate cannot recover it for you.',
        pageWidth / 2,
        startY + 6 * rowHeight + 30,
        { align: 'center', maxWidth: pageWidth - 120 },
      );

      // jsPDF returns the PDF as a data-URI string; strip the prefix and
      // hand the base64 payload to the small `write_file_base64` Tauri
      // command that decodes and writes raw bytes.
      const dataUri = doc.output('datauristring');
      const dataBase64 = dataUri.split(',', 2)[1] ?? '';
      await invoke('write_file_base64', { path: target, dataBase64 });
      setSavedPdf(true);
      showToast('Recovery key saved as PDF', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? `Save failed: ${err.message}` : 'Save failed',
        'error',
      );
    }
  }, [words, email, showToast]);

  const handleCopy = useCallback(async () => {
    if (words.length !== TOTAL_WORDS) return;
    try {
      await navigator.clipboard.writeText(wordsJoined);
      setSavedClipboard(true);
      showToast('Recovery key copied to clipboard', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? `Copy failed: ${err.message}` : 'Copy failed',
        'error',
      );
    }
  }, [words, wordsJoined, showToast]);

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    setContinuing(true);
    try {
      await invoke('delete_file_silent', { path: recoveryKeySavedTo });
    } catch {
      // Silent on cleanup — file may already be gone. Don't block continue.
    }
    onContinue();
  }, [canContinue, recoveryKeySavedTo, onContinue]);

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-panel p-6 shadow-lg rounded-lg"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby="recovery-key-description"
        >
          <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
            Save your recovery key
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            id="recovery-key-description"
            className="text-sm text-muted-foreground"
          >
            Save your recovery key somewhere safe. If you forget your passphrase, this is
            the only way back in. We can&apos;t recover it for you.
          </DialogPrimitive.Description>

          {loadError && (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground"
            >
              {loadError}
            </div>
          )}

          {words.length === TOTAL_WORDS && (
            <dl
              data-testid="recovery-key-grid"
              className="grid grid-cols-4 gap-2 rounded-md border border-border bg-background p-4 font-mono text-sm"
              aria-label="Your 24-word recovery key"
            >
              {words.map((word, idx) => (
                <div key={idx} className="flex items-baseline gap-2">
                  <dt className="text-xs tabular-nums text-muted-foreground w-6 text-right">
                    {String(idx + 1).padStart(2, '0')}.
                  </dt>
                  <dd className="font-medium">{word}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SaveMethodButton
              icon={<Download className="h-4 w-4" />}
              label="Save to file"
              saved={savedFile}
              onClick={handleSaveFile}
              disabled={words.length !== TOTAL_WORDS}
            />
            <SaveMethodButton
              icon={<FileText className="h-4 w-4" />}
              label="Save as PDF"
              saved={savedPdf}
              onClick={handleSavePdf}
              disabled={words.length !== TOTAL_WORDS}
            />
            <SaveMethodButton
              icon={<Copy className="h-4 w-4" />}
              label="Copy"
              saved={savedClipboard}
              onClick={handleCopy}
              disabled={words.length !== TOTAL_WORDS}
            />
          </div>

          <p className="text-xs text-muted-foreground" data-testid="saves-progress">
            {savesUsed} of {REQUIRED_SAVES} required save methods used.
          </p>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              data-testid="recovery-key-continue"
            >
              {continuing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Continuing
                </>
              ) : (
                "I've saved my recovery key, continue"
              )}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SaveMethodButton({
  icon,
  label,
  saved,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  saved: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={saved ? 'secondary' : 'primary'}
      onClick={onClick}
      disabled={disabled}
      className="w-full justify-start"
      data-testid={`save-method-${label.replace(/\s+/g, '-').toLowerCase()}`}
      data-saved={saved ? 'true' : 'false'}
    >
      {saved ? <Check className="h-4 w-4 mr-2" /> : <span className="mr-2">{icon}</span>}
      {label}
      {saved && <span className="sr-only"> (saved)</span>}
    </Button>
  );
}
