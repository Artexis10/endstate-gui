/**
 * Sign-in form for hosted backup.
 *
 * Calls `backupLogin` (passphrase via stdin) and on success invokes
 * `onSignedIn(data)` so the parent pane can route to the backup pane.
 */

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { backupLogin, BackupCommandError } from '@/lib/backup-bridge';
import type { BackupLoginData } from '@/types';
import type { AppSettings } from '@/settings';
import { Loader2 } from 'lucide-react';
import { friendlyAuthError, type FriendlyAuthError } from './auth-errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInFormProps {
  settings: AppSettings;
  onSignedIn: (data: BackupLoginData) => void;
  onSwitchTab: (tab: 'sign-up' | 'recover') => void;
}

export function SignInForm({ settings, onSignedIn, onSwitchTab }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<FriendlyAuthError | null>(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const passphraseValid = passphrase.length >= 1; // login allows any saved passphrase
  const canSubmit = emailValid && passphraseValid && !busy;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setAuthError(null);
    try {
      const data = await backupLogin(settings, { email: email.trim(), passphrase });
      onSignedIn(data);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Sign in">
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
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          required
        />
      </label>
      {authError && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground"
          data-testid="sign-in-error"
        >
          <p className="font-medium">{authError.message}</p>
          {authError.remediation && (
            <p className="mt-1 text-xs text-muted-foreground">{authError.remediation}</p>
          )}
          {authError.cta && authError.cta.tab !== 'sign-in' && (
            <button
              type="button"
              onClick={() => onSwitchTab(authError.cta!.tab as 'sign-up' | 'recover')}
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
            Signing in
          </>
        ) : (
          'Sign in'
        )}
      </Button>
      <div className="space-y-2 pt-1 text-center text-sm">
        <div className="text-muted-foreground">
          New to Endstate?{' '}
          <button
            type="button"
            onClick={() => onSwitchTab('sign-up')}
            className="text-primary underline-offset-2 hover:underline"
          >
            Create an account
          </button>
        </div>
        <button
          type="button"
          onClick={() => onSwitchTab('recover')}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          I forgot my password
        </button>
      </div>
    </form>
  );
}
