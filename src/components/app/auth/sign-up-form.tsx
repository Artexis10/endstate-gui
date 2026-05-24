/**
 * Sign-up form for hosted backup.
 *
 * Two branches:
 *   - Default: collect email + passphrase + confirm, call `backupSignup`.
 *   - Claim mode (opt-in via text link): hide email, surface a 43-char
 *     claim-code paste field, call `backupClaim` instead. Substrate already
 *     has the email from Paddle; surfacing an editable email here would
 *     invite mismatches with the pre-account on record.
 *
 * Both branches kick the engine off and on success funnel through
 * `onSignedUp(BackupSignupData)` so the parent opens the recovery-key dialog
 * (load-bearing per contract §1).
 */

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { backupSignup, backupClaim, BackupCommandError } from '@/lib/backup-bridge';
import type { BackupSignupData } from '@/types';
import type { AppSettings } from '@/settings';
import { invoke } from '@/lib/tauri-bridge';
import { Loader2 } from 'lucide-react';
import { friendlyAuthError, type FriendlyAuthError } from './auth-errors';
import type { AuthTab } from './use-auth-state';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLAIM_CODE_REGEX = /^[A-Za-z0-9_-]{43}$/;
const CLAIM_DEEPLINK_PREFIX = 'endstate://claim?token=';
const MIN_PASSPHRASE_LENGTH = 12;

export interface SignUpFormProps {
  settings: AppSettings;
  onSignedUp: (data: BackupSignupData) => void;
  onSwitchTab: (tab: AuthTab) => void;
}

/**
 * Normalise raw paste input to a candidate claim token. Trims whitespace,
 * then strips the `endstate://claim?token=` deep-link prefix if present so
 * users can paste either the bare code or the full link from their email.
 * Exported so the regex/prefix contract is unit-testable in isolation.
 */
export function normalizeClaimCode(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith(CLAIM_DEEPLINK_PREFIX)
    ? trimmed.slice(CLAIM_DEEPLINK_PREFIX.length)
    : trimmed;
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
  const [claimMode, setClaimMode] = useState(false);
  const [email, setEmail] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<FriendlyAuthError | null>(null);

  const normalizedClaim = normalizeClaimCode(claimCode);
  const emailValid = EMAIL_REGEX.test(email.trim());
  const claimValid = CLAIM_CODE_REGEX.test(normalizedClaim);
  const passphraseLongEnough = passphrase.length >= MIN_PASSPHRASE_LENGTH;
  const passphrasesMatch = passphrase.length > 0 && passphrase === confirm;
  const identityValid = claimMode ? claimValid : emailValid;
  const canSubmit = identityValid && passphraseLongEnough && passphrasesMatch && !busy;

  // Inline validation messages — only shown after the user has typed
  let inlineError: string | null = null;
  if (claimMode && claimCode.length > 0 && !claimValid)
    inlineError = 'Enter a valid claim code.';
  else if (!claimMode && email.length > 0 && !emailValid)
    inlineError = 'Enter a valid email address.';
  else if (passphrase.length > 0 && !passphraseLongEnough)
    inlineError = `Password must be at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  else if (confirm.length > 0 && !passphrasesMatch)
    inlineError = 'Passwords do not match.';

  const toggleClaimMode = (next: boolean) => {
    setClaimMode(next);
    setAuthError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setAuthError(null);
    try {
      const saveRecoveryTo = await buildRecoveryTempPath();
      const data = claimMode
        ? await backupClaim(settings, {
            token: normalizedClaim,
            passphrase,
            saveRecoveryTo,
          })
        : await backupSignup(settings, {
            email: email.trim(),
            passphrase,
            saveRecoveryTo,
          });
      onSignedUp(data);
    } catch (err) {
      if (err instanceof BackupCommandError) {
        setAuthError(friendlyAuthError(err));
      } else {
        setAuthError({ message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Sign up">
      {claimMode ? (
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Claim code</span>
            <Input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="Paste the code from your purchase email"
              required
            />
          </label>
          <span className="text-xs text-muted-foreground">
            We&apos;ll use the email on file from your purchase.
          </span>
        </div>
      ) : (
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
      )}
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Password</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
          />
        </label>
        <span className="text-xs text-muted-foreground">
          At least {MIN_PASSPHRASE_LENGTH} characters. Choose something you can remember.
        </span>
      </div>
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
      {(inlineError || authError) && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground"
          data-testid="sign-up-error"
        >
          <p className="font-medium">{authError?.message ?? inlineError}</p>
          {authError?.remediation && (
            <p className="mt-1 text-xs text-muted-foreground">{authError.remediation}</p>
          )}
          {authError?.cta && (
            <button
              type="button"
              onClick={() => onSwitchTab(authError.cta!.tab)}
              className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {authError.cta.label} →
            </button>
          )}
        </div>
      )}
      <Button type="submit" disabled={!canSubmit} className="w-full">
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {claimMode ? 'Claiming account' : 'Creating account'}
          </>
        ) : claimMode ? (
          'Claim account'
        ) : (
          'Create account'
        )}
      </Button>
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => toggleClaimMode(!claimMode)}
          className="text-primary underline-offset-2 hover:underline"
        >
          {claimMode
            ? 'Use a regular sign-up instead'
            : 'Have a Hosted Backup claim code?'}
        </button>
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
