import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { AccountSection } from './account-section';
import type { AppSettings } from '@/settings';

vi.mock('@/lib/backup-bridge', () => ({
  backupLogout: vi.fn(),
  accountDelete: vi.fn(),
  backupBrowserSession: vi.fn(),
  BackupCommandError: class BackupCommandError extends Error {},
}));

const SETTINGS = {} as AppSettings;
const STATUS = {
  signedIn: true,
  email: 'selfhost@example.test',
  subscriptionStatus: 'none' as const,
  issuerUrl: 'https://backup.example.test',
};

describe('AccountSection', () => {
  it('retains account controls while suppressing managed billing for self-hosted services', () => {
    renderWithProviders(
      <AccountSection
        settings={SETTINGS}
        status={STATUS}
        managedService={false}
        onSignedOut={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByTestId('account-email')).toHaveTextContent('selfhost@example.test');
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
    expect(screen.queryByTestId('account-subscription-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /manage subscription/i })).not.toBeInTheDocument();
  });
});
