/**
 * Forgot-passphrase recovery form.
 *
 * Accepts email + 24-word recovery mnemonic + new passphrase + confirmation,
 * then calls `backupRecover` (mnemonic + new passphrase via stdin per the
 * engine's two-line stdin protocol).
 *
 * Client-side validation is intentionally minimal:
 * - Email format
 * - Mnemonic word count (exactly 24, whitespace-separated)
 * - Passphrase length and confirmation match
 *
 * Anything else (BIP39 wordlist membership, recovery-key proof) is the
 * engine's job — letting the server reject lets us avoid shipping the BIP39
 * wordlist on the GUI side.
 */

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { backupRecover, BackupCommandError } from '@/lib/backup-bridge';
import type { BackupRecoverData } from '@/types';
import type { AppSettings } from '@/settings';
import { Loader2 } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSPHRASE_LENGTH = 12;
const MNEMONIC_WORD_COUNT = 24;

export interface RecoverFormProps {
  settings: AppSettings;
  onRecovered: (data: BackupRecoverData) => void;
  onSwitchTab: (tab: 'sign-in') => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export function RecoverForm({ settings, onRecovered, onSwitchTab }: RecoverFormProps) {
  const [email, setEmail] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRemediation, setErrorRemediation] = useState<string | null>(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const wordCount = countWords(mnemonic);
  const mnemonicValid = wordCount === MNEMONIC_WORD_COUNT;
  const passphraseLongEnough = newPassphrase.length >= MIN_PASSPHRASE_LENGTH;
  const passphrasesMatch = newPassphrase.length > 0 && newPassphrase === confirm;
  const canSubmit =
    emailValid && mnemonicValid && passphraseLongEnough && passphrasesMatch && !busy;

  let inlineError: string | null = null;
  if (email.length > 0 && !emailValid) inlineError = 'Enter a valid email address.';
  else if (mnemonic.length > 0 && !mnemonicValid)
    inlineError = `Recovery key must be ${MNEMONIC_WORD_COUNT} words (you typed ${wordCount}).`;
  else if (newPassphrase.length > 0 && !passphraseLongEnough)
    inlineError = `New password must be at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  else if (confirm.length > 0 && !passphrasesMatch)
    inlineError = 'Passwords do not match.';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErrorMessage(null);
    setErrorRemediation(null);
    try {
      // Normalize whitespace inside the mnemonic to single spaces.
      const normalizedMnemonic = mnemonic.trim().split(/\s+/).join(' ');
      const data = await backupRecover(settings, {
        email: email.trim(),
        mnemonic: normalizedMnemonic,
        newPassphrase,
      });
      onRecovered(data);
    } catch (err) {
      if (err instanceof BackupCommandError) {
        setErrorMessage(err.message);
        setErrorRemediation(err.remediation ?? null);
      } else {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Recover account">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Recovery key</span>
        <Textarea
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          rows={3}
          required
          className="font-mono"
          placeholder="Paste your 24-word recovery key, separated by spaces"
          aria-label="Recovery key (24 words)"
        />
        <span className="text-xs text-muted-foreground">
          {wordCount} of {MNEMONIC_WORD_COUNT} words.
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">New password</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={newPassphrase}
          onChange={(e) => setNewPassphrase(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Confirm new password</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </label>
      {(inlineError || errorMessage) && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground"
        >
          <p className="font-medium">{errorMessage ?? inlineError}</p>
          {errorRemediation && (
            <p className="mt-1 text-xs text-muted-foreground">{errorRemediation}</p>
          )}
        </div>
      )}
      <Button type="submit" disabled={!canSubmit} className="w-full">
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Resetting password
          </>
        ) : (
          'Reset password'
        )}
      </Button>
      <div className="text-xs text-muted-foreground text-center">
        <button
          type="button"
          onClick={() => onSwitchTab('sign-in')}
          className="text-primary underline-offset-2 hover:underline"
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
