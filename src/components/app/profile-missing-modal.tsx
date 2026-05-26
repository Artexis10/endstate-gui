/**
 * Modal explaining that the previously-selected profile is gone, with
 * actionable next steps.
 *
 * Replaces the older info toast "Selected profile no longer exists — switched
 * to X." which fired silently after a delete OR at app-start when the saved
 * profile name didn't resolve to a file. The toast told the user a fact but
 * gave them nothing to do with it; this modal explains *why* the switch
 * happened and lets the user pick what should happen next.
 *
 * Action priorities:
 *   1. **Restore from cloud** — only shown when the previous profile has a
 *      cloud backup (i.e. user can recover the actual content, not just
 *      fall back to another local profile). This is the highest-value action
 *      and is rendered first when available.
 *   2. **Switch to {firstAvailable}** — the existing auto-switch behavior,
 *      now confirmed rather than silent. Default action.
 *   3. **Pick another profile** — opens ManageProfilesModal.
 *   4. **Continue without a profile** — explicit no-op for users who want to
 *      defer the decision.
 *
 * The pane never blocks — closing the dialog without picking an action
 * falls back to "Switch to {firstAvailable}" (mirrors the previous silent
 * behavior), so a user who reflexively closes still ends up in the most
 * familiar state.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cloud, FileX2 } from 'lucide-react';

export interface ProfileMissingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the profile that's gone — shown in the body copy. */
  previousName: string;
  /** Why it's missing — drives the explanatory body copy. */
  reason: 'deleted' | 'not-found';
  /** Display name of the fallback profile (or null when none available). */
  firstAvailableLabel: string | null;
  /** Whether the missing profile has a cloud backup. Gates the Restore CTA. */
  hasCloudBackup: boolean;
  onSwitchToFirstAvailable: () => void;
  onRestoreFromCloud: () => void;
  onPickAnother: () => void;
  onContinueWithoutProfile: () => void;
}

export function ProfileMissingModal({
  open,
  onOpenChange,
  previousName,
  reason,
  firstAvailableLabel,
  hasCloudBackup,
  onSwitchToFirstAvailable,
  onRestoreFromCloud,
  onPickAnother,
  onContinueWithoutProfile,
}: ProfileMissingModalProps) {
  const headline =
    reason === 'deleted'
      ? `"${previousName}" was deleted`
      : `"${previousName}" couldn't be found`;
  const body =
    reason === 'deleted'
      ? 'The profile you had selected was just removed. Pick what should happen next:'
      : 'The profile you had selected isn\'t in this folder anymore — it may have been moved or removed, or the profiles folder changed. Pick what should happen next:';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="profile-missing-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileX2 className="h-5 w-5 text-warning" aria-hidden="true" />
            {headline}
          </DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {hasCloudBackup && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                onOpenChange(false);
                onRestoreFromCloud();
              }}
              data-testid="profile-missing-restore-cloud"
              className="justify-start"
            >
              <Cloud className="h-4 w-4" />
              Restore "{previousName}" from your cloud backup
            </Button>
          )}
          {firstAvailableLabel && (
            <Button
              type="button"
              variant={hasCloudBackup ? 'secondary' : 'primary'}
              onClick={() => {
                onOpenChange(false);
                onSwitchToFirstAvailable();
              }}
              data-testid="profile-missing-switch"
              className="justify-start"
            >
              Switch to "{firstAvailableLabel}"
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              onPickAnother();
            }}
            data-testid="profile-missing-pick-another"
            className="justify-start"
          >
            Pick another profile
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onContinueWithoutProfile();
            }}
            data-testid="profile-missing-continue-without"
            className="justify-start text-muted-foreground"
          >
            Continue without a profile
          </Button>
        </div>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
