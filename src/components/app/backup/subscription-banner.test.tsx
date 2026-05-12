/**
 * Subscription banner — table-driven rendering test for the four contract §10
 * states (none / active / grace / cancelled). Verifies copy, tone, and the
 * action button label, plus that an undefined status falls through to "none".
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { SubscriptionBanner } from './subscription-banner';
import type { SubscriptionStatus } from '@/types';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/tauri-bridge', () => ({
  invoke: vi.fn(),
}));

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
    expectedTextIncludes: 'Hosted Backup active',
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
});
