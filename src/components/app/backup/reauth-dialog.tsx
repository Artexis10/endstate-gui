/**
 * Re-auth dialog for hosted-backup session loss.
 *
 * Opens inline when a backup command returns `AUTH_REQUIRED`. Wraps the
 * existing `SignInForm` inside a shadcn `<Dialog>` with the email field
 * pre-filled and locked, so the user re-authenticates as the same identity
 * without losing the pane state behind the dialog.
 *
 * Manual-retry semantics: after a successful re-auth, the dialog dismisses
 * and the caller is responsible for refreshing status. The in-flight
 * operation (push / pull / etc.) is NOT auto-resumed — the user re-clicks
 * the action they were trying to do (per Wave 6 design decision; auto-resume
 * requires engine-side partial-upload safety that is out of scope).
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignInForm } from '@/components/app/auth/sign-in-form';
import type { AppSettings } from '@/settings';
import type { BackupLoginData } from '@/types';

export interface ReauthDialogProps {
  open: boolean;
  settings: AppSettings;
  /** When set, the dialog locks the email field to this address so re-auth
   *  stays on the same identity. Pass the previously-signed-in email. */
  expectedEmail?: string;
  onReauthenticated: (data: BackupLoginData) => void;
  onDismiss: () => void;
}

export function ReauthDialog({
  open,
  settings,
  expectedEmail,
  onReauthenticated,
  onDismiss,
}: ReauthDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="max-w-md" data-testid="reauth-dialog">
        <DialogHeader>
          <DialogTitle>Sign in again to continue</DialogTitle>
          <DialogDescription>
            {expectedEmail
              ? `Your Endstate Cloud session expired. Enter the password for ${expectedEmail} to keep going.`
              : 'Your Endstate Cloud session expired. Sign in again to keep going.'}
          </DialogDescription>
        </DialogHeader>
        <SignInForm
          settings={settings}
          lockedEmail={expectedEmail}
          onSignedIn={onReauthenticated}
          onSwitchTab={() => {
            /* Locked re-auth: switch-tab is suppressed by SignInForm
             * when `lockedEmail` is set; this stub satisfies the prop. */
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
