import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthPane } from './auth-pane';
import type { AppSettings } from '@/settings';

const SETTINGS = {} as AppSettings;

describe('AuthPane claim setup', () => {
  it('uses the claim heading and supports an explicit empty manual token', () => {
    renderWithProviders(
      <AuthPane
        settings={SETTINGS}
        initialClaimMode
        initialClaimToken=""
        onAuthenticated={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Finish account setup' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /purchase code/i })).toHaveValue('');
  });

  it('switches from claim setup to regular sign-up explicitly', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AuthPane
        settings={SETTINGS}
        initialClaimMode
        initialClaimToken={'A'.repeat(43)}
        onAuthenticated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /use regular sign-up instead/i }));

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
  });

  it('stays in regular mode after leaving a deep-link claim for sign in and returning', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AuthPane
        settings={SETTINGS}
        initialClaimMode
        initialClaimToken={'A'.repeat(43)}
        onAuthenticated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /use regular sign-up instead/i }));
    await user.click(screen.getByRole('button', { name: /already have an account/i }));
    await user.click(screen.getByRole('button', { name: /create an account/i }));

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.queryByText(/purchase link is ready/i)).not.toBeInTheDocument();
  });

  it('does not resurrect manually-entered claim mode after navigating away', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AuthPane
        settings={SETTINGS}
        initialTab="sign-up"
        onAuthenticated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /use purchase code/i }));
    expect(screen.getByRole('heading', { name: 'Finish account setup' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /already have an account/i }));
    await user.click(screen.getByRole('button', { name: /create an account/i }));

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
  });

  it('resets form state when a new keyed claim setup is mounted', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    const { rerender } = renderWithProviders(
      <AuthPane
        key="claim-1"
        settings={SETTINGS}
        initialClaimMode
        initialClaimToken={'A'.repeat(43)}
        onAuthenticated={onAuthenticated}
      />,
    );
    await user.type(screen.getByLabelText('Password'), 'partially-entered-password');

    rerender(
      <AuthPane
        key="claim-2"
        settings={SETTINGS}
        initialClaimMode
        initialClaimToken={'B'.repeat(43)}
        onAuthenticated={onAuthenticated}
      />,
    );

    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByText(/purchase link is ready/i)).toBeInTheDocument();
  });
});
