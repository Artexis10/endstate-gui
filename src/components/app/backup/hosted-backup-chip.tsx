/**
 * Hosted Backup status chip — small inline affordance shown at the top of
 * the Save and Setup flows so users can sign in (or see their backup status)
 * without leaving the flow.
 *
 * Renders nothing when hosted backup is unsupported by the engine.
 *
 * State variants:
 *   - signed-out     → muted "Sign in to Hosted Backup" text link
 *   - active         → primary-tinted chip "Hosted Backup · Active"
 *   - grace          → warning-tinted chip "Hosted Backup · Renew"
 *   - cancelled      → warning-tinted chip "Hosted Backup · Renew"
 *   - none + signed-in → muted "Subscribe to Hosted Backup" (rare; user
 *     finished signup but never paid)
 *
 * Clicking always routes to the Backup pane (`onOpen`) — the pane handles
 * the next step (auth pane, subscription banner, etc.) based on the same
 * state we read here.
 */

import { Cloud } from 'lucide-react';
import type { SubscriptionStatus } from '@/types';

export interface HostedBackupChipProps {
  hostedBackupSupported: boolean;
  signedIn: boolean;
  subscriptionStatus?: SubscriptionStatus;
  onOpen: () => void;
}

export function HostedBackupChip({
  hostedBackupSupported,
  signedIn,
  subscriptionStatus,
  onOpen,
}: HostedBackupChipProps) {
  if (!hostedBackupSupported) return null;

  const effective: SubscriptionStatus =
    !signedIn ? 'none' : subscriptionStatus ?? 'none';

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid="hosted-backup-chip"
        data-state="signed-out"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Sign in to Hosted Backup</span>
      </button>
    );
  }

  if (effective === 'active') {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid="hosted-backup-chip"
        data-state="active"
        title="Backups are up to date. Click to manage."
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Hosted Backup · Active</span>
      </button>
    );
  }

  if (effective === 'grace' || effective === 'cancelled') {
    const label = effective === 'cancelled' ? 'Renew' : 'Fix billing';
    return (
      <button
        type="button"
        onClick={onOpen}
        data-testid="hosted-backup-chip"
        data-state={effective}
        title={
          effective === 'cancelled'
            ? 'Subscription cancelled. Backups read-only until renewed.'
            : 'Payment failed. Fix billing to keep backups.'
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs text-warning-foreground hover:bg-warning/20 transition-colors"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Hosted Backup · {label}</span>
      </button>
    );
  }

  // signedIn but subscriptionStatus === 'none' — finished signup, never paid.
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="hosted-backup-chip"
      data-state="none"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
    >
      <Cloud className="h-3.5 w-3.5" />
      <span>Subscribe to Hosted Backup</span>
    </button>
  );
}
