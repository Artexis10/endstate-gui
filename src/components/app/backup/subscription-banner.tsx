/**
 * Subscription state banner for the backup pane.
 *
 * Renders one of four states per Hosted Backup contract §10:
 *   - `active`    — subscription paid, current
 *   - `grace`     — payment failed, 30-day grace window (read OK, write blocked)
 *   - `cancelled` — user cancelled, 30-day retention (read OK, write blocked)
 *   - `none` (or undefined) — never subscribed / fully cancelled past retention
 *
 * Presentational only: side effects (opening URLs, invoking the engine) live
 * in the pane and are passed in as callbacks. This keeps the banner trivial
 * to render-test and lets the pane own the in-flight / toast / auth-lost
 * routing.
 */

import { Button } from '@/components/ui/button';
import type { SubscriptionStatus } from '@/types';
import { CheckCircle2, AlertTriangle, OctagonX, Sparkles } from 'lucide-react';

export interface SubscriptionBannerProps {
  status?: SubscriptionStatus;
  /**
   * ISO 8601 timestamp marking the end of the 30-day grace window. When set
   * and the status is `grace`, the description renders the literal date so
   * the user has a precise deadline rather than the calmer "within 30 days"
   * fallback. Absent for non-grace states.
   */
  graceEndsAt?: string;
  /**
   * Begin a checkout. Wired by the pane to call `backup subscribe` and open
   * the returned `checkoutUrl`. Used by the Subscribe (`none`) and Renew
   * (`cancelled`) actions. The pane's handler is `async` so the contract
   * accepts `Promise<void>`; the banner does not await it (it observes
   * progress via `checkoutPending`).
   */
  onCheckout?: () => void | Promise<void>;
  /** Disables the Subscribe/Renew button while a checkout is in flight. */
  checkoutPending?: boolean;
  /**
   * Open the substrate billing-portal URL for an existing subscription
   * (active / grace). The pane resolves the URL; the banner doesn't know
   * what it is. Different from `onCheckout` — Manage is a portal session,
   * not a new checkout transaction.
   */
  onManage?: () => void | Promise<void>;
  /** Disables the Manage button while the engine round-trip is in flight. */
  managePending?: boolean;
}

function formatGraceDeadline(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SubscriptionBanner({
  status,
  graceEndsAt,
  onCheckout,
  checkoutPending = false,
  onManage,
  managePending = false,
}: SubscriptionBannerProps) {
  const effective = status ?? 'none';

  if (effective === 'active') {
    return (
      <BannerShell
        tone="success"
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Hosted Backup active"
        description="Your backups are up to date."
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onManage}
            disabled={managePending}
            data-testid="subscription-manage"
          >
            {managePending ? 'Opening…' : 'Manage subscription'}
          </Button>
        }
      />
    );
  }

  if (effective === 'grace') {
    const deadline = formatGraceDeadline(graceEndsAt);
    return (
      <BannerShell
        tone="warn"
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Payment failed"
        description={
          deadline
            ? `Backups stay safe through ${deadline}. Fix billing to keep them.`
            : 'Fix billing within 30 days to keep backups.'
        }
        action={
          <Button
            type="button"
            variant="primary"
            onClick={onManage}
            disabled={managePending}
            data-testid="subscription-manage"
          >
            {managePending ? 'Opening…' : 'Manage subscription'}
          </Button>
        }
      />
    );
  }

  if (effective === 'cancelled') {
    return (
      <BannerShell
        tone="error"
        icon={<OctagonX className="h-5 w-5" />}
        title="Subscription cancelled"
        description="Backups read-only. Data will be purged after the 30-day retention window."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={onCheckout}
            disabled={checkoutPending}
            data-testid="subscription-renew"
          >
            Renew subscription
          </Button>
        }
      />
    );
  }

  // none / undefined
  return (
    <BannerShell
      tone="info"
      icon={<Sparkles className="h-5 w-5" />}
      title="Subscribe to enable hosted backup"
      description="Encrypted backups in the cloud. Restore on any machine."
      action={
        <Button
          type="button"
          variant="primary"
          onClick={onCheckout}
          disabled={checkoutPending}
          data-testid="subscription-subscribe"
        >
          Subscribe
        </Button>
      }
    />
  );
}

function BannerShell({
  tone,
  icon,
  title,
  description,
  action,
}: {
  tone: 'success' | 'warn' | 'error' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  const toneClass = {
    success: 'border-success/30 bg-success/10',
    warn: 'border-warning/30 bg-warning/10',
    error: 'border-danger/30 bg-danger/10',
    info: 'border-primary/30 bg-primary/10',
  }[tone];

  return (
    <div
      role="status"
      data-testid="subscription-banner"
      data-tone={tone}
      className={`flex items-center justify-between gap-4 rounded-md border ${toneClass} p-4`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
