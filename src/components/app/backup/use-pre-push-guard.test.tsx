import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/test-utils';
import type { AppSettings } from '@/settings';
import type { BackupStatusData } from '@/types';
import { usePrePushGuard } from './use-pre-push-guard';

// The hook only reaches the engine via backupEstimate — mock just that.
vi.mock('@/lib/backup-bridge', () => ({
  backupEstimate: vi.fn(),
}));
import { backupEstimate } from '@/lib/backup-bridge';

const GiB = 1024 * 1024 * 1024;
const settings = {} as AppSettings;

function Harness({ status, run }: { status: BackupStatusData; run: () => void }) {
  const { guardPush, dialog } = usePrePushGuard(settings, status);
  return (
    <>
      {/* eslint-disable-next-line react/forbid-elements -- test harness trigger, not production UI */}
      <button onClick={() => void guardPush({ profile: '/p/profile' }, run)}>go</button>
      {dialog}
    </>
  );
}

const statusWith = (used: number, total: number): BackupStatusData =>
  ({ signedIn: true, issuerUrl: 'x', quotaUsedBytes: used, quotaTotalBytes: total } as BackupStatusData);

describe('usePrePushGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pushes immediately (no dialog) when the estimate fits comfortably', async () => {
    (backupEstimate as ReturnType<typeof vi.fn>).mockResolvedValue({
      estimatedUploadBytes: 10 * 1024 * 1024,
      plaintextBytes: 9 * 1024 * 1024,
      chunkCount: 1,
    });
    const run = vi.fn();
    renderWithProviders(<Harness status={statusWith(50 * 1024 * 1024, GiB)} run={run} />);

    fireEvent.click(screen.getByRole('button', { name: 'go' }));

    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the warning dialog (and defers the push) when near/over quota', async () => {
    (backupEstimate as ReturnType<typeof vi.fn>).mockResolvedValue({
      estimatedUploadBytes: 200 * 1024 * 1024,
      plaintextBytes: 190 * 1024 * 1024,
      chunkCount: 1,
    });
    const run = vi.fn();
    // 900 MiB used + 200 MiB push > 1 GiB → exceeds.
    renderWithProviders(<Harness status={statusWith(900 * 1024 * 1024, GiB)} run={run} />);

    fireEvent.click(screen.getByRole('button', { name: 'go' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(run).not.toHaveBeenCalled();

    // Confirm → the push runs.
    fireEvent.click(screen.getByRole('button', { name: /push anyway/i }));
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
  });

  it('pushes anyway (graceful) when the estimate command fails', async () => {
    (backupEstimate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no estimate command'));
    const run = vi.fn();
    renderWithProviders(<Harness status={statusWith(900 * 1024 * 1024, GiB)} run={run} />);

    fireEvent.click(screen.getByRole('button', { name: 'go' }));

    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
