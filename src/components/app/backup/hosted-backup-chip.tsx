/**
 * Hosted Backup status chip — small inline affordance shown at the top of
 * the Save and Setup flows so users can sign in (or see their backup status)
 * without leaving the flow.
 *
 * Renders nothing when hosted backup is unsupported by the engine.
 *
 * State variants:
 *   - signed-out     → muted "Sign in to Endstate Cloud" text link
 *   - active         → primary-tinted chip "Endstate Cloud · Active"
 *   - grace          → warning-tinted chip "Endstate Cloud · Renew"
 *   - cancelled      → warning-tinted chip "Endstate Cloud · Renew"
 *   - none + signed-in → muted "Subscribe to Endstate Cloud" (rare; user
 *     finished signup but never paid)
 *
 * Clicking always routes to the Backup pane (`onOpen`) — the pane handles
 * the next step (auth pane, subscription banner, etc.) based on the same
 * state we read here.
 */

import { Cloud } from 'lucide-react';
import { Pill } from '@/components/ui/pill';
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
      <Pill
        onClick={onOpen}
        data-testid="hosted-backup-chip"
        data-state="signed-out"
        className="border-border bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Sign in to Endstate Cloud</span>
      </Pill>
    );
  }

  if (effective === 'active') {
    return (
      <Pill
        onClick={onOpen}
        data-testid="hosted-backup-chip"
        data-state="active"
        title="Backups are up to date. Click to manage."
        className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Endstate Cloud · Active</span>
      </Pill>
    );
  }

  if (effective === 'grace' || effective === 'cancelled') {
    const label = effective === 'cancelled' ? 'Renew' : 'Fix billing';
    return (
      <Pill
        onClick={onOpen}
        data-testid="hosted-backup-chip"
        data-state={effective}
        title={
          effective === 'cancelled'
            ? 'Subscription cancelled. Backups read-only until renewed.'
            : 'Payment failed. Fix billing to keep backups.'
        }
        className="border-warning/30 bg-warning/10 text-warning-foreground hover:bg-warning/20"
      >
        <Cloud className="h-3.5 w-3.5" />
        <span>Endstate Cloud · {label}</span>
      </Pill>
    );
  }

  // signedIn but subscriptionStatus === 'none' — finished signup, never paid.
  return (
    <Pill
      onClick={onOpen}
      data-testid="hosted-backup-chip"
      data-state="none"
      className="border-border bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground"
    >
      <Cloud className="h-3.5 w-3.5" />
      <span>Subscribe to Endstate Cloud</span>
    </Pill>
  );
}
