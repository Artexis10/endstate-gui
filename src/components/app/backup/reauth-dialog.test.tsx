/**
 * Re-auth dialog — Wave 6 hosted-backup polish.
 *
 * Pins the contract from `openspec/changes/polish-backup-errors-and-reauth`:
 *   - email is pre-filled and locked when `expectedEmail` is set
 *   - successful sign-in calls onReauthenticated with the login data
 *   - closing the dialog (Escape / overlay click) calls onDismiss
 *   - failed sign-in surfaces inline; does NOT bubble to onDismiss
 *   - the switch-tab footer (create account / forgot password) is hidden
 *     while locked
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { ReauthDialog } from './reauth-dialog';
import { BackupCommandError } from '@/lib/backup-bridge';
import type { AppSettings } from '@/settings';
import type { BackupLoginData } from '@/types';

const backupLoginMock = vi.fn();

vi.mock('@/lib/backup-bridge', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backup-bridge')>(
    '@/lib/backup-bridge',
  );
  return {
    ...actual,
    backupLogin: (...args: unknown[]) => backupLoginMock(...args),
  };
});

const SETTINGS: AppSettings = {} as AppSettings;
const LOGIN_DATA: BackupLoginData = {
  userId: 'u-1',
  email: 'alice@example.com',
  subscriptionStatus: 'active',
};

function renderDialog(
  overrides: Partial<Parameters<typeof ReauthDialog>[0]> = {},
) {
  const onReauthenticated = vi.fn();
  const onDismiss = vi.fn();
  renderWithProviders(
    <ReauthDialog
      open
      settings={SETTINGS}
      expectedEmail="alice@example.com"
      onReauthenticated={onReauthenticated}
      onDismiss={onDismiss}
      {...overrides}
    />,
  );
  return { onReauthenticated, onDismiss };
}

beforeEach(() => {
  backupLoginMock.mockReset();
});

describe('ReauthDialog', () => {
  it('pre-fills and locks the email field when expectedEmail is set', () => {
    renderDialog();
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(email.value).toBe('alice@example.com');
    expect(email).toBeDisabled();
    expect(email).toHaveAttribute('readonly');
  });

  it('hides the switch-tab footer when locked', () => {
    renderDialog();
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot my password/i)).not.toBeInTheDocument();
  });

  it('mentions the expected email in the description', () => {
    renderDialog();
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
  });

  it('calls onReauthenticated with login data on success', async () => {
    backupLoginMock.mockResolvedValueOnce(LOGIN_DATA);
    const { onReauthenticated, onDismiss } = renderDialog();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/password/i), 'correct-passphrase');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onReauthenticated).toHaveBeenCalledWith(LOGIN_DATA);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('surfaces wrong-password errors inline, does not call onDismiss', async () => {
    backupLoginMock.mockRejectedValueOnce(
      new BackupCommandError({
        code: 'AUTH_REQUIRED',
        message: 'invalid credentials',
      }),
    );
    const { onReauthenticated, onDismiss } = renderDialog();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('sign-in-error')).toBeInTheDocument();
    });
    expect(onReauthenticated).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders nothing when open is false', () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId('reauth-dialog')).not.toBeInTheDocument();
  });

  it('allows editable email when expectedEmail is omitted', () => {
    renderDialog({ expectedEmail: undefined });
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(email.value).toBe('');
    expect(email).not.toBeDisabled();
    expect(email).not.toHaveAttribute('readonly');
  });

  it('calls onDismiss when the user presses Escape', async () => {
    const { onDismiss } = renderDialog();
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
