/**
 * Sign-up form for hosted backup.
 *
 * Validates email + passphrase + confirmation locally, then calls
 * `backupSignup` with the engine writing the 24-word recovery mnemonic to
 * a temp path. On success invokes `onSignedUp(data, passphrase)` so the
 * parent can open the recovery-key dialog.
 *
 * Per contract §1, recovery-key presentation is mandatory — this form does
 * NOT route to the backup pane on its own.
 */

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { backupSignup, BackupCommandError } from '@/lib/backup-bridge';
import type { BackupSignupData } from '@/types';
import type { AppSettings } from '@/settings';
import { invoke } from '@/lib/tauri-bridge';
import { Loader2 } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSPHRASE_LENGTH = 12;

export interface SignUpFormProps {
  settings: AppSettings;
  onSignedUp: (data: BackupSignupData) => void;
  onSwitchTab: (tab: 'sign-in') => void;
}

/** Build a fresh temp path for the engine to write the recovery mnemonic to. */
async function buildRecoveryTempPath(): Promise<string> {
  const cacheDir = await invoke<string>('get_capture_cache_directory');
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Reuse the existing capture cache dir — it's already gitignored, in
  // %LOCALAPPDATA%, and cleaned on app start.
  return `${cacheDir}\\recovery-${stamp}.txt`;
}

export function SignUpForm({ settings, onSignedUp, onSwitchTab }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRemediation, setErrorRemediation] = useState<string | null>(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const passphraseLongEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const passphrasesMatch = passphrase.length > 0 && passphrase === confirm;
  const canSubmit = emailValid && passphraseLongEnough && passphrasesMatch && !busy;

  // Inline validation messages — only shown after the user has typed
  let inlineError: string | null = null;
  if (email.length > 0 && !emailValid) inlineError = 'Enter a valid email address.';
  else if (passphrase.length > 0 && !passphraseLongEnough)
    inlineError = `Password must be at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  else if (confirm.length > 0 && !passphrasesMatch)
    inlineError = 'Passwords do not match.';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErrorMessage(null);
    setErrorRemediation(null);
    try {
      const saveRecoveryTo = await buildRecoveryTempPath();
      const data = await backupSignup(settings, {
        email: email.trim(),
        passphrase,
        saveRecoveryTo,
      });
      onSignedUp(data);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Sign up">
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
        <span className="text-sm font-medium">Password</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
        />
        <span className="text-xs text-muted-foreground">
          At least {MIN_PASSPHRASE_LENGTH} characters. Choose something you can remember.
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Confirm password</span>
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
            Creating account
          </>
        ) : (
          'Create account'
        )}
      </Button>
      <div className="text-xs text-muted-foreground text-center">
        <button
          type="button"
          onClick={() => onSwitchTab('sign-in')}
          className="text-primary underline-offset-2 hover:underline"
        >
          Already have an account? Sign in
        </button>
      </div>
    </form>
  );
}
