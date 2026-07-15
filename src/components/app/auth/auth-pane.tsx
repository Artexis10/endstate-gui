/**
 * Hosted-backup auth pane.
 *
 * Single-view shell: sign-in is the default. Sign-up and recover are reached
 * via text links in the sign-in form footer; each presents its own form with
 * a "back to sign in" link. No tabs — recover is a serious action and should
 * not sit at equal visual weight with sign-in.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthState, AuthTab } from './use-auth-state';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';
import { RecoverForm } from './recover-form';
import { RecoveryKeyDialog } from './recovery-key-dialog';
import type { BackupLoginData, BackupSignupData, BackupRecoverData } from '@/types';
import type { AppSettings } from '@/settings';

export interface AuthPaneProps {
  settings: AppSettings;
  /** Initial view: 'sign-in' (default), 'sign-up', or 'recover'. The
   *  signed-out Backup pane sets this to 'sign-up' when the user clicks
   *  "Create account" so they don't have to switch tabs after arriving. */
  initialTab?: AuthTab;
  /** Starts the sign-up form in the purchase-claim branch even when the token
   * is empty (the manual fallback). */
  initialClaimMode?: boolean;
  /** Valid claim token held in React memory for a native deep-link launch. */
  initialClaimToken?: string;
  /** Locks claim-intent routing while the mandatory recovery dialog owns the
   * just-created account credentials. */
  onRecoveryPendingChange?: (pending: boolean) => void;
  /** Called when the user has been authenticated (sign-in, signed-up + saved
   *  recovery key, or recovered via mnemonic). The handler should fetch
   *  `backupStatus` and route to the backup pane. */
  onAuthenticated: (
    result:
      | { kind: 'signed-in'; data: BackupLoginData }
      | { kind: 'signed-up'; data: BackupSignupData }
      | { kind: 'recovered'; data: BackupRecoverData },
  ) => void | Promise<void>;
}

const HEADINGS = {
  'sign-in': { title: 'Sign in to Endstate', description: 'Access your hosted backups.' },
  'sign-up': { title: 'Create your account', description: 'You\'ll get a recovery key in the next step.' },
  'recover': { title: 'Recover your account', description: 'You\'ll need the 24-word recovery key you saved at sign-up.' },
} as const;

export function AuthPane({
  settings,
  initialTab = 'sign-in',
  initialClaimMode = false,
  initialClaimToken = '',
  onRecoveryPendingChange,
  onAuthenticated,
}: AuthPaneProps) {
  const { activeTab, setActiveTab } = useAuthState(
    initialClaimMode ? 'sign-up' : initialTab,
  );
  const [claimState, setClaimState] = useState({
    mode: initialClaimMode,
    token: initialClaimToken,
    prefilled: initialClaimMode && initialClaimToken.length > 0,
  });
  const [pendingSignup, setPendingSignup] = useState<BackupSignupData | null>(null);

  const handleSwitchTab = useCallback((tab: AuthTab) => {
    if (tab !== 'sign-up') {
      setClaimState({ mode: false, token: '', prefilled: false });
    }
    setActiveTab(tab);
  }, [setActiveTab]);

  const handleClaimModeChange = useCallback((mode: boolean) => {
    setClaimState((current) => ({
      mode,
      token: mode ? current.token : '',
      prefilled: mode ? current.prefilled : false,
    }));
  }, []);

  const handleClaimTokenChange = useCallback((token: string) => {
    setClaimState((current) => ({ ...current, token, prefilled: false }));
  }, []);

  const handleSignedIn = useCallback(
    (data: BackupLoginData) => onAuthenticated({ kind: 'signed-in', data }),
    [onAuthenticated],
  );
  const handleSignedUp = useCallback((data: BackupSignupData) => {
    setPendingSignup(data);
    onRecoveryPendingChange?.(true);
  }, [onRecoveryPendingChange]);
  const handleRecovered = useCallback(
    (data: BackupRecoverData) => onAuthenticated({ kind: 'recovered', data }),
    [onAuthenticated],
  );
  const handleRecoveryDialogContinue = useCallback(async () => {
    if (!pendingSignup) return;
    const data = pendingSignup;
    await onAuthenticated({ kind: 'signed-up', data });
    setPendingSignup(null);
    onRecoveryPendingChange?.(false);
  }, [pendingSignup, onAuthenticated, onRecoveryPendingChange]);

  const heading = activeTab === 'sign-up' && claimState.mode
    ? {
        title: 'Finish account setup',
        description: 'Choose a password, then save your recovery key.',
      }
    : HEADINGS[activeTab];

  return (
    <div className="flex w-full justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{heading.title}</CardTitle>
          <CardDescription>{heading.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {activeTab === 'sign-in' && (
            <SignInForm
              settings={settings}
              onSignedIn={handleSignedIn}
              onSwitchTab={handleSwitchTab}
            />
          )}
          {activeTab === 'sign-up' && (
            <SignUpForm
              settings={settings}
              onSignedUp={handleSignedUp}
              onSwitchTab={handleSwitchTab}
              initialClaimMode={initialClaimMode}
              initialClaimToken={initialClaimToken}
              claimMode={claimState.mode}
              claimToken={claimState.token}
              claimTokenPrefilled={claimState.prefilled}
              onClaimModeChange={handleClaimModeChange}
              onClaimTokenChange={handleClaimTokenChange}
            />
          )}
          {activeTab === 'recover' && (
            <RecoverForm
              settings={settings}
              onRecovered={handleRecovered}
              onSwitchTab={handleSwitchTab}
            />
          )}
        </CardContent>
      </Card>
      {pendingSignup && (
        <RecoveryKeyDialog
          open
          recoveryKeySavedTo={pendingSignup.recoveryKeySavedTo}
          email={pendingSignup.email}
          onContinue={handleRecoveryDialogContinue}
        />
      )}
    </div>
  );
}
