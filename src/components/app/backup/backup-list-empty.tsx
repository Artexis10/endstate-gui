/**
 * Empty-state card for the backup list. Two variants:
 *
 *   - `active` subscription: a celebratory post-claim landing with explicit
 *     next-actions ("Capture this computer" + optional "Push existing").
 *     Shown to a freshly-claimed user who has paid and is signed in but has
 *     not yet pushed a backup.
 *   - Any other subscription state (none / grace / cancelled): the calm
 *     placeholder. The SubscriptionBanner above already tells the user what
 *     to do next (subscribe / renew / fix billing).
 */

import { Cloud, HardDrive, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SubscriptionStatus } from '@/types';

export interface BackupListEmptyProps {
  subscriptionStatus: SubscriptionStatus;
  /** Route to the Setup flow ("capture this computer"). */
  onCapture?: () => void;
  /** Push the currently-selected profile (only renders when both are set). */
  onPushExisting?: () => void;
  selectedProfileName?: string | null;
}

export function BackupListEmpty({
  subscriptionStatus,
  onCapture,
  onPushExisting,
  selectedProfileName,
}: BackupListEmptyProps) {
  if (subscriptionStatus === 'active') {
    return (
      <Card data-testid="backup-list-empty" data-variant="active">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Cloud className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Your subscription is active — create your first cloud backup
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cloud backups encrypt with your passphrase before upload.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onCapture && (
              <Button
                type="button"
                variant="primary"
                onClick={onCapture}
                data-testid="backup-list-empty-capture"
              >
                Capture this computer
              </Button>
            )}
            {onPushExisting && selectedProfileName && (
              <Button
                type="button"
                variant="secondary"
                onClick={onPushExisting}
                data-testid="backup-list-empty-push-existing"
              >
                <Upload className="h-4 w-4" />
                Push {selectedProfileName}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="backup-list-empty" data-variant="inactive">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <HardDrive className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No backups yet. Push a profile to create the first version.
        </p>
      </CardContent>
    </Card>
  );
}
