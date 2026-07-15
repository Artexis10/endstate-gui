/**
 * Sign-up form — claim-code branch + state-machine + error-mapping coverage.
 *
 * Pins the contract from `openspec/changes/add-hosted-backup-claim-input`:
 *   - default form shows email + "Use purchase code" link
 *   - toggling claim mode hides email and reveals the paste field
 *   - going back restores email and preserves the password value
 *   - the deep-link prefix and surrounding whitespace are stripped from the
 *     pasted token before validation / before calling `backupClaim`
 *   - submit branches between `backupSignup` and `backupClaim` based on mode
 *   - the four claim error codes (`CLAIM_TOKEN_*`, `KDF_TOO_WEAK`) surface
 *     friendly copy via `friendlyAuthError`
 *   - `CLAIM_TOKEN_CONSUMED` renders a Sign-in CTA that calls `onSwitchTab`
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { SignUpForm, normalizeClaimCode } from './sign-up-form';
import { BackupCommandError } from '@/lib/backup-bridge';
import type { AppSettings } from '@/settings';
import type { BackupSignupData } from '@/types';

const backupSignupMock = vi.fn();
const backupClaimMock = vi.fn();

vi.mock('@/lib/backup-bridge', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backup-bridge')>(
    '@/lib/backup-bridge',
  );
  return {
    ...actual,
    backupSignup: (...args: unknown[]) => backupSignupMock(...args),
    backupClaim: (...args: unknown[]) => backupClaimMock(...args),
  };
});

vi.mock('@/lib/tauri-bridge', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'get_capture_cache_directory') {
      return Promise.resolve('C:\\Users\\test\\AppData\\Local\\endstate\\cache');
    }
    return Promise.resolve();
  }),
  isTauriRuntime: () => true,
}));

const SETTINGS: AppSettings = {} as AppSettings;

const VALID_TOKEN = 'A'.repeat(43); // 43 chars, all in [A-Za-z0-9_-]
const VALID_PASSWORD = 'correct-horse-battery-staple';
const SIGNUP_DATA: BackupSignupData = {
  userId: 'u-1',
  email: 'buyer@example.com',
  subscriptionStatus: 'active',
  recoveryKeySavedTo: 'C:\\tmp\\recovery.txt',
};

function renderForm(overrides: Partial<Parameters<typeof SignUpForm>[0]> = {}) {
  const onSignedUp = vi.fn();
  const onSwitchTab = vi.fn();
  renderWithProviders(
    <SignUpForm
      settings={SETTINGS}
      onSignedUp={onSignedUp}
      onSwitchTab={onSwitchTab}
      {...overrides}
    />,
  );
  return { onSignedUp, onSwitchTab };
}

beforeEach(() => {
  backupSignupMock.mockReset();
  backupClaimMock.mockReset();
});

describe('normalizeClaimCode', () => {
  it('returns the trimmed input unchanged for a bare token', () => {
    expect(normalizeClaimCode(VALID_TOKEN)).toBe(VALID_TOKEN);
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeClaimCode(`  ${VALID_TOKEN}\n`)).toBe(VALID_TOKEN);
  });

  it('strips the endstate://claim?token= deep-link prefix', () => {
    expect(normalizeClaimCode(`endstate://claim?token=${VALID_TOKEN}`)).toBe(
      VALID_TOKEN,
    );
  });

  it('strips the prefix and trims together', () => {
    expect(normalizeClaimCode(`  endstate://claim?token=${VALID_TOKEN}  `)).toBe(
      VALID_TOKEN,
    );
  });
});

describe('SignUpForm — default branch', () => {
  it('renders email + the claim-code toggle link', () => {
    renderForm();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /use purchase code/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /purchase code/i }),
    ).not.toBeInTheDocument();
  });

  it('submits via backupSignup and forwards data through onSignedUp', async () => {
    const user = userEvent.setup();
    backupSignupMock.mockResolvedValueOnce(SIGNUP_DATA);
    const { onSignedUp } = renderForm();

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'buyer@example.com');
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(backupSignupMock).toHaveBeenCalledOnce());
    expect(backupSignupMock).toHaveBeenCalledWith(SETTINGS, {
      email: 'buyer@example.com',
      passphrase: VALID_PASSWORD,
      saveRecoveryTo: expect.stringMatching(/recovery-/),
    });
    expect(backupClaimMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledWith(SIGNUP_DATA));
  });
});

describe('SignUpForm — claim mode toggle', () => {
  it('hides email and reveals the paste field; preserves password', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(
      screen.getByRole('button', { name: /use purchase code/i }),
    );

    expect(
      screen.queryByRole('textbox', { name: /^email$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /purchase code/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue(VALID_PASSWORD);
    expect(
      screen.getByRole('button', { name: /finish setup/i }),
    ).toBeInTheDocument();
  });

  it('returns to default form when "Use a regular sign-up instead" is clicked', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(
      screen.getByRole('button', { name: /use purchase code/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /use regular sign-up instead/i }),
    );

    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /purchase code/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue(VALID_PASSWORD);
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it('keeps submit disabled while the pasted token is malformed', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: /use purchase code/i }),
    );
    await user.type(
      screen.getByRole('textbox', { name: /purchase code/i }),
      'not-a-token',
    );
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);

    expect(screen.getByRole('button', { name: /finish setup/i })).toBeDisabled();
    expect(screen.getByText(/enter a valid claim code/i)).toBeInTheDocument();
  });

  it('keeps the manual purchase-code input visible while typing a complete token', async () => {
    const user = userEvent.setup();
    renderForm({ initialClaimMode: true });

    const code = screen.getByRole('textbox', { name: /purchase code/i });
    await user.type(code, VALID_TOKEN);

    expect(screen.getByRole('textbox', { name: /purchase code/i })).toHaveValue(VALID_TOKEN);
    expect(screen.queryByText(/purchase link is ready/i)).not.toBeInTheDocument();
  });
});

describe('SignUpForm — claim submission', () => {
  it('starts in manual claim mode with an empty required purchase-code field', async () => {
    const user = userEvent.setup();
    renderForm({ initialClaimMode: true });

    const code = screen.getByRole('textbox', { name: /purchase code/i });
    expect(code).toHaveValue('');
    expect(code).toHaveAttribute(
      'placeholder',
      'Paste the code from your Endstate email',
    );

    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);
    expect(screen.getByRole('button', { name: /finish setup/i })).toBeDisabled();
  });

  it('uses a valid prefilled token without prominently exposing it', async () => {
    const user = userEvent.setup();
    backupClaimMock.mockResolvedValueOnce(SIGNUP_DATA);
    renderForm({ initialClaimMode: true, initialClaimToken: VALID_TOKEN });

    expect(screen.getByText(/purchase link is ready/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /purchase code/i })).not.toBeInTheDocument();
    expect(screen.queryByText(VALID_TOKEN)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    expect(screen.getByRole('button', { name: /finish setup/i })).toBeDisabled();
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /finish setup/i }));

    await waitFor(() => expect(backupClaimMock).toHaveBeenCalledWith(SETTINGS, {
      token: VALID_TOKEN,
      passphrase: VALID_PASSWORD,
      saveRecoveryTo: expect.stringMatching(/recovery-/),
    }));
  });

  it('calls backupClaim with the normalised token from a pasted deep link', async () => {
    const user = userEvent.setup();
    backupClaimMock.mockResolvedValueOnce(SIGNUP_DATA);
    const { onSignedUp } = renderForm();

    await user.click(
      screen.getByRole('button', { name: /use purchase code/i }),
    );
    await user.type(
      screen.getByRole('textbox', { name: /purchase code/i }),
      `endstate://claim?token=${VALID_TOKEN}`,
    );
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /finish setup/i }));

    await waitFor(() => expect(backupClaimMock).toHaveBeenCalledOnce());
    expect(backupClaimMock).toHaveBeenCalledWith(SETTINGS, {
      token: VALID_TOKEN,
      passphrase: VALID_PASSWORD,
      saveRecoveryTo: expect.stringMatching(/recovery-/),
    });
    expect(backupSignupMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledWith(SIGNUP_DATA));
  });

  it('surfaces CLAIM_TOKEN_INVALID via friendlyAuthError, with no CTA', async () => {
    const user = userEvent.setup();
    backupClaimMock.mockRejectedValueOnce(
      new BackupCommandError({
        code: 'CLAIM_TOKEN_INVALID',
        message: 'engine raw',
        remediation: 'Run `endstate backup claim` again.',
      }),
    );
    renderForm();

    await user.click(
      screen.getByRole('button', { name: /use purchase code/i }),
    );
    await user.type(screen.getByRole('textbox', { name: /purchase code/i }), VALID_TOKEN);
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /finish setup/i }));

    const alert = await screen.findByTestId('sign-up-error');
    expect(alert).toHaveTextContent(/doesn't match any active link/i);
    expect(alert).toHaveTextContent(/purchase email/i);
    expect(alert).not.toHaveTextContent(/`endstate /);
    // CTA is rendered inside the alert; the footer "Already have an account? Sign in"
    // link lives outside the alert and is unrelated.
    expect(
      within(alert).queryByRole('button', { name: /sign in/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a Sign-in CTA for CLAIM_TOKEN_CONSUMED and calls onSwitchTab', async () => {
    const user = userEvent.setup();
    backupClaimMock.mockRejectedValueOnce(
      new BackupCommandError({
        code: 'CLAIM_TOKEN_CONSUMED',
        message: 'engine raw',
      }),
    );
    const { onSwitchTab } = renderForm();

    await user.click(
      screen.getByRole('button', { name: /use purchase code/i }),
    );
    await user.type(screen.getByRole('textbox', { name: /purchase code/i }), VALID_TOKEN);
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /finish setup/i }));

    const alert = await screen.findByTestId('sign-up-error');
    const cta = within(alert).getByRole('button', { name: /sign in/i });
    await user.click(cta);
    expect(onSwitchTab).toHaveBeenCalledWith('sign-in');
  });
});
