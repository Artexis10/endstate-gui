import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/test-utils';
import { LastSyncIndicator } from './last-sync-indicator';

// Frozen anchor mirrors format-relative-time.test.ts so deltas are deterministic
// across runs / timezones. 2026-05-29T12:00:00Z (Date.UTC month is 0-indexed).
const FROZEN_NOW_MS = Date.UTC(2026, 4, 29, 12, 0, 0);

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

function isoAgo(deltaMs: number): string {
  return new Date(FROZEN_NOW_MS - deltaMs).toISOString();
}

describe('LastSyncIndicator', () => {
  describe('fresh band (< 24h)', () => {
    it('renders "Last synced Just now" with muted tint for a sub-minute timestamp', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(30_000)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('Last synced Just now');
      expect(el).toHaveAttribute('data-freshness', 'fresh');
      expect(el).toHaveClass('text-muted-foreground');
    });

    it('renders "Last synced N min ago" with muted tint within the hour', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(15 * ONE_MINUTE_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('Last synced 15 min ago');
      expect(el).toHaveAttribute('data-freshness', 'fresh');
      expect(el).toHaveClass('text-muted-foreground');
    });

    it('renders "Last synced N hours ago" with muted tint within the day', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(5 * ONE_HOUR_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('Last synced 5 hours ago');
      expect(el).toHaveAttribute('data-freshness', 'fresh');
      expect(el).toHaveClass('text-muted-foreground');
    });
  });

  describe('stale band (24h–7d)', () => {
    it('renders "Last synced N days ago" with warning tint', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(3 * ONE_DAY_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('Last synced 3 days ago');
      expect(el).toHaveAttribute('data-freshness', 'stale');
      expect(el).toHaveClass('text-warning/80');
    });

    it('renders "Last synced 1 day ago" (singular) at the 24h boundary', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(ONE_DAY_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('Last synced 1 day ago');
      expect(el).toHaveAttribute('data-freshness', 'stale');
      expect(el).toHaveClass('text-warning/80');
    });
  });

  describe('very-stale band (>= 7d)', () => {
    it('renders "Last synced on <locale date>" with danger tint', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(30 * ONE_DAY_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      // Locale-fragile — do NOT pin the literal string. Only assert prefix +
      // that some digit (day-of-month) appears.
      expect(el.textContent ?? '').toMatch(/^Last synced on .*\d/);
      expect(el).toHaveAttribute('data-freshness', 'very-stale');
      expect(el).toHaveClass('text-danger/80');
    });

    it('renders very-stale at the exact 7d boundary', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(ONE_WEEK_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el.textContent ?? '').toMatch(/^Last synced on .*\d/);
      expect(el).toHaveAttribute('data-freshness', 'very-stale');
      expect(el).toHaveClass('text-danger/80');
    });
  });

  describe('never band (missing / unparseable)', () => {
    it('renders "No backups yet" with muted tint when lastBackupAt is undefined', () => {
      renderWithProviders(
        <LastSyncIndicator lastBackupAt={undefined} nowMs={FROZEN_NOW_MS} />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('No backups yet');
      expect(el).not.toHaveTextContent('Last synced');
      expect(el).toHaveAttribute('data-freshness', 'never');
      expect(el).toHaveClass('text-muted-foreground');
    });

    it('renders "No backups yet" when lastBackupAt is an empty string', () => {
      renderWithProviders(
        <LastSyncIndicator lastBackupAt="" nowMs={FROZEN_NOW_MS} />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('No backups yet');
      expect(el).toHaveAttribute('data-freshness', 'never');
      expect(el).toHaveClass('text-muted-foreground');
    });

    it('renders "No backups yet" when lastBackupAt is unparseable', () => {
      renderWithProviders(
        <LastSyncIndicator lastBackupAt="not-a-date" nowMs={FROZEN_NOW_MS} />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('No backups yet');
      expect(el).toHaveAttribute('data-freshness', 'never');
      expect(el).toHaveClass('text-muted-foreground');
    });
  });

  describe('auto-backup paused (AUTH_REQUIRED)', () => {
    it('replaces the freshness label with an actionable "Sign in to resume backups"', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(ONE_HOUR_MS)}
          nowMs={FROZEN_NOW_MS}
          authPaused
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).toHaveTextContent('Sign in to resume backups');
      // Paused overrides the freshness label even when a recent backup exists.
      expect(el).not.toHaveTextContent('Last synced');
      expect(el).toHaveAttribute('data-paused', 'true');
      expect(el).toHaveClass('text-warning/90');
      expect(screen.getByRole('button', { name: /sign in to resume backups/i })).toBeInTheDocument();
    });

    it('invokes onResumeClick when clicked', async () => {
      const onResumeClick = vi.fn();
      renderWithProviders(
        <LastSyncIndicator authPaused onResumeClick={onResumeClick} nowMs={FROZEN_NOW_MS} />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: /sign in to resume backups/i }),
      );
      expect(onResumeClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('a11y — deliberately not a live region', () => {
    it('does not declare role="status" or aria-live (per plan)', () => {
      renderWithProviders(
        <LastSyncIndicator
          lastBackupAt={isoAgo(ONE_HOUR_MS)}
          nowMs={FROZEN_NOW_MS}
        />,
      );
      const el = screen.getByTestId('last-sync-indicator');
      expect(el).not.toHaveAttribute('role');
      expect(el).not.toHaveAttribute('aria-live');
    });
  });
});
