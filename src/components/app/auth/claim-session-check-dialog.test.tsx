import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { ClaimSessionCheckDialog } from './claim-session-check-dialog';

describe('ClaimSessionCheckDialog', () => {
  it('offers a generic token-safe retry when session verification fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <ClaimSessionCheckDialog open busy={false} onRetry={onRetry} />,
    );

    expect(screen.getByRole('heading', { name: /check your account session/i })).toBeInTheDocument();
    expect(screen.getByText(/retry the session check to continue/i)).toBeInTheDocument();
    expect(screen.queryByText(/purchase link/i)).not.toBeInTheDocument();
    expect(screen.queryByText('A'.repeat(43))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry session check/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
