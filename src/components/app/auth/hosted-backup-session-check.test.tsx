import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HostedBackupSessionCheck } from './hosted-backup-session-check';

describe('HostedBackupSessionCheck', () => {
  it('offers an inline retry after a non-claim session check failure', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderWithProviders(
      <HostedBackupSessionCheck failed busy={false} onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/could not check your endstate cloud session/i);
    await user.click(screen.getByRole('button', { name: /retry session check/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders a passive checking state before a failure', () => {
    renderWithProviders(
      <HostedBackupSessionCheck failed={false} busy={false} onRetry={vi.fn()} />,
    );

    expect(screen.getByText(/checking your endstate cloud session/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps a self-hosted session failure free of managed purchase routes', () => {
    renderWithProviders(
      <HostedBackupSessionCheck
        providerKind="self-hosted"
        failed
        busy={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/self-hosted backup service/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/account|purchase code/i);
  });
});
