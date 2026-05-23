/**
 * Subscription state banner for the backup pane.
 *
 * Renders one of four states per Hosted Backup contract §10:
 *   - `active`    — subscription paid, current
 *   - `grace`     — payment failed, 30-day grace window (read OK, write blocked)
 *   - `cancelled` — user cancelled, 30-day retention (read OK, write blocked)
 *   - `none` (or undefined) — never subscribed / fully cancelled past retention
 *
 * Subscription portal URLs are hardcoded for v1 per the design decision in
 * `openspec/changes/add-hosted-backup-gui/design.md`. Substrate's `/account`
 * route is a follow-up; the link ships regardless.
 */

import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri-bridge';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import type { SubscriptionStatus } from '@/types';
import { CheckCircle2, AlertTriangle, OctagonX, Sparkles } from 'lucide-react';

// Until substrate ships a dedicated customer-portal route, "Manage" points at
// the product page. Subscribe/Renew no longer use a static URL — they invoke
// the engine's `backup subscribe` command (via `onCheckout`) to mint a real
// Paddle checkout transaction and open the returned URL.
const MANAGE_URL = 'https://substratesystems.io/endstate';

export interface SubscriptionBannerProps {
  status?: SubscriptionStatus;
  /**
   * Begin a checkout. Wired by the pane to call `backup subscribe` and open
   * the returned `checkoutUrl`. Used by the Subscribe (`none`) and Renew
   * (`cancelled`) actions. Optional so the render-only test can omit it.
   */
  onCheckout?: () => void;
  /** Disables the Subscribe/Renew button while a checkout is in flight. */
  checkoutPending?: boolean;
}

async function openUrl(url: string): Promise<void> {
  // Prefer the Tauri shell plugin (already in lib.rs plugin list).
  // Fallback to window.open for the web-mode test runtime.
  try {
    if (typeof invoke === 'function') {
      await openExternal(url);
      return;
    }
  } catch {
    // ignore — fall through to window.open
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function SubscriptionBanner({
  status,
  onCheckout,
  checkoutPending = false,
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
            onClick={() => openUrl(MANAGE_URL)}
            data-testid="subscription-manage"
          >
            Manage subscription
          </Button>
        }
      />
    );
  }

  if (effective === 'grace') {
    return (
      <BannerShell
        tone="warn"
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Payment failed"
        description="Fix billing within 30 days to keep backups."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() => openUrl(MANAGE_URL)}
            data-testid="subscription-manage"
          >
            Manage subscription
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
