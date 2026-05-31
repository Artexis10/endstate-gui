import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { AutoBackupConsent } from './auto-backup-consent';

describe('AutoBackupConsent', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<AutoBackupConsent open={false} onDecision={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the prompt with the toggle pre-set ON', async () => {
    renderWithProviders(<AutoBackupConsent open onDecision={vi.fn()} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('confirms with auto-backup enabled by default', async () => {
    const onDecision = vi.fn();
    renderWithProviders(<AutoBackupConsent open onDecision={onDecision} />);
    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(true);
  });

  it('declining (toggle off then confirm) disables auto-backup', async () => {
    const onDecision = vi.fn();
    renderWithProviders(<AutoBackupConsent open onDecision={onDecision} />);
    await userEvent.click(screen.getByRole('switch')); // turn OFF
    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith(false);
  });

  it('fires the decision at most once (no double-call on confirm)', async () => {
    const onDecision = vi.fn();
    renderWithProviders(<AutoBackupConsent open onDecision={onDecision} />);
    const done = screen.getByRole('button', { name: /done/i });
    await userEvent.click(done);
    expect(onDecision).toHaveBeenCalledTimes(1);
  });
});
