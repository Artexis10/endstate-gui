/**
 * Hosted-backup auth pane.
 *
 * Three-tab shell (Sign in / Sign up / Recover) plus the load-bearing
 * recovery-key dialog launched after a successful sign-up.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthState, AuthTab } from './use-auth-state';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';
import { RecoverForm } from './recover-form';
import { RecoveryKeyDialog } from './recovery-key-dialog';
import type { BackupLoginData, BackupSignupData, BackupRecoverData } from '@/types';
import type { AppSettings } from '@/settings';

export interface AuthPaneProps {
  settings: AppSettings;
  /** Called when the user has been authenticated (sign-in, signed-up + saved
   *  recovery key, or recovered via mnemonic). The handler should fetch
   *  `backupStatus` and route to the backup pane. */
  onAuthenticated: (
    result:
      | { kind: 'signed-in'; data: BackupLoginData }
      | { kind: 'signed-up'; data: BackupSignupData }
      | { kind: 'recovered'; data: BackupRecoverData },
  ) => void;
}

export function AuthPane({ settings, onAuthenticated }: AuthPaneProps) {
  const { activeTab, setActiveTab } = useAuthState('sign-in');
  const [pendingSignup, setPendingSignup] = useState<BackupSignupData | null>(null);

  const handleSignedIn = useCallback(
    (data: BackupLoginData) => onAuthenticated({ kind: 'signed-in', data }),
    [onAuthenticated],
  );
  const handleSignedUp = useCallback((data: BackupSignupData) => {
    setPendingSignup(data);
  }, []);
  const handleRecovered = useCallback(
    (data: BackupRecoverData) => onAuthenticated({ kind: 'recovered', data }),
    [onAuthenticated],
  );
  const handleRecoveryDialogContinue = useCallback(() => {
    if (!pendingSignup) return;
    const data = pendingSignup;
    setPendingSignup(null);
    onAuthenticated({ kind: 'signed-up', data });
  }, [pendingSignup, onAuthenticated]);

  return (
    <div className="flex w-full justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Endstate Hosted Backup</CardTitle>
          <TabsHeader activeTab={activeTab} onChange={setActiveTab} />
        </CardHeader>
        <CardContent>
          {activeTab === 'sign-in' && (
            <SignInForm
              settings={settings}
              onSignedIn={handleSignedIn}
              onSwitchTab={setActiveTab}
            />
          )}
          {activeTab === 'sign-up' && (
            <SignUpForm
              settings={settings}
              onSignedUp={handleSignedUp}
              onSwitchTab={setActiveTab}
            />
          )}
          {activeTab === 'recover' && (
            <RecoverForm
              settings={settings}
              onRecovered={handleRecovered}
              onSwitchTab={setActiveTab}
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

function TabsHeader({
  activeTab,
  onChange,
}: {
  activeTab: AuthTab;
  onChange: (tab: AuthTab) => void;
}) {
  const tabs: { id: AuthTab; label: string }[] = [
    { id: 'sign-in', label: 'Sign in' },
    { id: 'sign-up', label: 'Sign up' },
    { id: 'recover', label: 'Recover' },
  ];
  return (
    <div role="tablist" aria-label="Auth options" className="flex gap-1 mt-2 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`auth-tab-panel-${tab.id}`}
          data-testid={`auth-tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={
            activeTab === tab.id
              ? 'px-3 py-2 text-sm font-medium border-b-2 border-primary text-foreground'
              : 'px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
