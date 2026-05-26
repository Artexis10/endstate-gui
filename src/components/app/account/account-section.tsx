/**
 * Account section in Settings (only when signed in).
 *
 * Shows the user's email, current subscription status pill, Manage subscription
 * (routes through the engine's `backup browser-session` command to mint a short
 * -lived handoff into substrate's `/account` portal), Sign out, and Delete
 * account.
 */

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { useToast } from '@/components/ui/toast';
import {
  backupLogout,
  accountDelete,
  backupBrowserSession,
  BackupCommandError,
} from '@/lib/backup-bridge';
import { friendlyBackupError } from '@/lib/backup-errors';
import { AccountDeleteModal } from './account-delete-modal';
import type { BackupStatusData, SubscriptionStatus } from '@/types';
import type { AppSettings } from '@/settings';

export interface AccountSectionProps {
  settings: AppSettings;
  status: BackupStatusData;
  onSignedOut: () => void;
  onDeleted: () => void;
  /** Called when the engine reports AUTH_REQUIRED — session expired mid-click.
   *  Parent should clear hosted-backup state and route back to the sign-in
   *  flow with a calm toast. Optional: when absent, AUTH_REQUIRED is shown
   *  as a friendly toast (graceful degradation). */
  onAuthLost?: () => void;
}

const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  none: 'No subscription',
  active: 'Active',
  grace: 'Payment failed',
  cancelled: 'Cancelled',
};

const SUBSCRIPTION_TONE: Record<SubscriptionStatus, string> = {
  none: 'border-muted bg-muted/20 text-muted-foreground',
  active: 'border-success/30 bg-success/10 text-success',
  grace: 'border-warning/30 bg-warning/10 text-warning',
  cancelled: 'border-danger/30 bg-danger/10 text-danger',
};

export function AccountSection({
  settings,
  status,
  onSignedOut,
  onDeleted,
  onAuthLost,
}: AccountSectionProps) {
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [managePending, setManagePending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const subscription: SubscriptionStatus = status.subscriptionStatus ?? 'none';

  // Manage subscription: same handoff flow as backup-pane.tsx's `handleManage`.
  // Mint a 60s JWT via the engine, then open `${accountUrl}?session=<jwt>`
  // externally. Substrate's `/account/start` swaps the JWT for an HttpOnly
  // cookie and 302s to the cookie-only `/account` page. See hosted-backup
  // contract §5 and the Endstate Account Portal Architecture decision.
  const handleManageSubscription = useCallback(async () => {
    if (managePending) return;
    setManagePending(true);
    try {
      const { sessionToken, accountUrl } = await backupBrowserSession(settings);
      const url = new URL(accountUrl);
      url.searchParams.set('session', sessionToken);
      await openExternal(url.toString());
    } catch (err) {
      if (err instanceof BackupCommandError && err.code === 'AUTH_REQUIRED') {
        onAuthLost?.();
        return;
      }
      if (err instanceof BackupCommandError) {
        const f = friendlyBackupError(err);
        showToast(f.headline, f.tone);
      } else {
        showToast(
          err instanceof Error ? err.message : String(err),
          'error',
        );
      }
    } finally {
      setManagePending(false);
    }
  }, [settings, managePending, onAuthLost, showToast]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await backupLogout(settings);
      showToast('Signed out.', 'info');
      onSignedOut();
    } catch (err) {
      if (err instanceof BackupCommandError) {
        showToast(err.message, 'error');
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      setSigningOut(false);
    }
  }, [settings, showToast, onSignedOut]);

  const handleDelete = useCallback(async () => {
    try {
      await accountDelete(settings);
      showToast('Account deleted.', 'info');
      onDeleted();
    } catch (err) {
      if (err instanceof BackupCommandError) {
        showToast(err.message, 'error');
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    }
  }, [settings, showToast, onDeleted]);

  return (
    <Card data-testid="account-section">
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm font-medium" data-testid="account-email">
            {status.email ?? '(unknown)'}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Subscription</p>
          <div className="flex items-center gap-2">
            <span
              data-testid="account-subscription-pill"
              data-subscription-status={subscription}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SUBSCRIPTION_TONE[subscription]}`}
            >
              {SUBSCRIPTION_LABEL[subscription]}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleManageSubscription}
              disabled={managePending}
              data-testid="account-manage-subscription"
            >
              {managePending ? 'Opening…' : 'Manage subscription'}
            </Button>
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSignOut}
            disabled={signingOut}
            data-testid="account-sign-out"
          >
            Sign out
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            data-testid="account-delete-button"
          >
            Delete account
          </Button>
        </div>
      </CardContent>
      <AccountDeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        expectedEmail={status.email ?? ''}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
