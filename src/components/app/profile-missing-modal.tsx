/**
 * Modal explaining that the previously-selected profile is gone, with
 * actionable next steps.
 *
 * Handles the startup case where the saved Capture profile no longer resolves
 * to a local file. Deliberate deletion clears the saved target without opening
 * this modal or switching to an unrelated profile.
 *
 * Action priorities:
 *   1. **Restore from cloud** — only shown when the previous profile has a
 *      cloud backup (i.e. user can recover the actual content, not just
 *      fall back to another local profile). This is the highest-value action
 *      and is rendered first when available.
 *   2. **Switch to {firstAvailable}** — an explicit replacement choice.
 *   3. **Continue without a profile** — explicit no-op for users who want to
 *      defer the decision.
 *
 * Closing the dialog defers the choice and leaves Capture without a saved
 * target; it never changes profiles implicitly.
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
  /** Display name of the fallback profile (or null when none available). */
  firstAvailableLabel: string | null;
  /** Whether the missing profile has a cloud backup. Gates the Restore CTA. */
  hasCloudBackup: boolean;
  onSwitchToFirstAvailable: () => void;
  onRestoreFromCloud: () => void;
  onContinueWithoutProfile: () => void;
}

export function ProfileMissingModal({
  open,
  onOpenChange,
  previousName,
  firstAvailableLabel,
  hasCloudBackup,
  onSwitchToFirstAvailable,
  onRestoreFromCloud,
  onContinueWithoutProfile,
}: ProfileMissingModalProps) {
  const headline = `"${previousName}" couldn't be found`;
  const body = 'The Capture profile you had selected isn\'t in this folder anymore — it may have been moved or removed, or the profiles folder changed. Pick what should happen next:';

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
