/**
 * Subscription banner — table-driven rendering test for the four contract §10
 * states (none / active / grace / cancelled). Verifies copy, tone, and the
 * action button label, plus that an undefined status falls through to "none".
 */

import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/test-utils';
import { SubscriptionBanner } from './subscription-banner';
import type { SubscriptionStatus } from '@/types';

// Banner is presentational — no side-effecting imports to mock. Side effects
// (shell.open, engine invoke) live in the pane and flow in via onCheckout /
// onManage callbacks; tests below assert those are called.

interface Case {
  status: SubscriptionStatus | undefined;
  tone: string;
  expectedTextIncludes: string;
  expectedActionLabel: string;
}

const CASES: Case[] = [
  {
    status: 'active',
    tone: 'success',
    expectedTextIncludes: 'Endstate Cloud active',
    expectedActionLabel: 'Manage subscription',
  },
  {
    status: 'grace',
    tone: 'warn',
    expectedTextIncludes: 'Payment failed',
    expectedActionLabel: 'Manage subscription',
  },
  {
    status: 'cancelled',
    tone: 'error',
    expectedTextIncludes: 'Subscription cancelled',
    expectedActionLabel: 'Renew subscription',
  },
  {
    status: 'none',
    tone: 'info',
    expectedTextIncludes: 'Subscribe to enable',
    expectedActionLabel: 'Subscribe',
  },
  {
    status: undefined,
    tone: 'info',
    expectedTextIncludes: 'Subscribe to enable',
    expectedActionLabel: 'Subscribe',
  },
];

describe('SubscriptionBanner', () => {
  it.each(CASES)(
    'renders status=$status with tone=$tone and label "$expectedActionLabel"',
    ({ status, tone, expectedTextIncludes, expectedActionLabel }) => {
      const { unmount } = renderWithProviders(<SubscriptionBanner status={status} />);
      const banner = screen.getByTestId('subscription-banner');
      expect(banner).toHaveAttribute('data-tone', tone);
      expect(banner).toHaveTextContent(expectedTextIncludes);
      expect(
        screen.getByRole('button', { name: expectedActionLabel }),
      ).toBeInTheDocument();
      unmount();
    },
  );

  it('does not claim a current backup version from billing status alone', () => {
    renderWithProviders(<SubscriptionBanner status="active" />);

    expect(screen.getByTestId('subscription-banner')).not.toHaveTextContent(/up to date/i);
  });

  it('limits the subscribe promise to another Windows PC and supported setup content', () => {
    renderWithProviders(<SubscriptionBanner status="none" />);

    expect(screen.getByText(/another Windows PC/i)).toBeInTheDocument();
    expect(screen.getByText(/Encrypted Endstate application lists and supported non-secret settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/any machine/i)).not.toBeInTheDocument();
  });

  it('invokes onCheckout when Subscribe is clicked (none state)', async () => {
    const onCheckout = vi.fn();
    renderWithProviders(
      <SubscriptionBanner status="none" onCheckout={onCheckout} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('invokes onCheckout when Renew is clicked (cancelled state)', async () => {
    const onCheckout = vi.fn();
    renderWithProviders(
      <SubscriptionBanner status="cancelled" onCheckout={onCheckout} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Renew subscription' }),
    );
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('disables Subscribe while a checkout is pending', () => {
    renderWithProviders(
      <SubscriptionBanner status="none" onCheckout={vi.fn()} checkoutPending />,
    );
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });

  it.each([
    { status: 'active' as const, label: 'Manage subscription' },
    { status: 'grace' as const, label: 'Manage subscription' },
  ])('invokes onManage when Manage is clicked ($status state)', async ({ status, label }) => {
    const onManage = vi.fn();
    renderWithProviders(<SubscriptionBanner status={status} onManage={onManage} />);
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(onManage).toHaveBeenCalledTimes(1);
  });
});
