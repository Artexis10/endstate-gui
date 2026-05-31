/**
 * Restore-on-new-machine wizard render contract.
 *
 * Pins the fix from branch `fix/restore-wizard-dialog-overlay`: the wizard
 * renders through the shadcn Dialog primitive (role=dialog, Radix
 * Portal-to-body, themed overlay) instead of a hand-rolled `fixed inset-0`
 * <div>. The old overlay, when mounted inside a transformed (framer-motion)
 * ancestor, was contained by that ancestor rather than the viewport — so it
 * rendered off-center with a backdrop the pane bled through ("transparent").
 * The `role=dialog` assertion below would have failed on the old markup.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { RestoreWizard } from './restore-wizard';
import type { AppSettings } from '@/settings';
import type { BackupListItem, BackupVersionItem } from '@/types';

const backupListMock = vi.fn();
const backupVersionsMock = vi.fn();

vi.mock('@/lib/backup-bridge', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backup-bridge')>(
    '@/lib/backup-bridge',
  );
  return {
    ...actual,
    backupList: (...args: unknown[]) => backupListMock(...args),
    backupVersions: (...args: unknown[]) => backupVersionsMock(...args),
  };
});

// Tauri plugins are imported at module top; stub so the import resolves in jsdom.
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));

const SETTINGS = {} as AppSettings;
const BACKUP = {
  id: 'b-1',
  name: 'hugo-desktop',
  versionCount: 1,
  totalSize: 15000,
  updatedAt: '2026-05-31T12:40:24.000Z',
} as BackupListItem;
const VERSION = {
  versionId: 'c1d4f820-aaaa-bbbb-cccc-ddddeeeeffff',
  createdAt: '2026-05-31T12:40:24.000Z',
} as BackupVersionItem;

function renderWizard(
  overrides: Partial<Parameters<typeof RestoreWizard>[0]> = {},
) {
  const onDismiss = vi.fn();
  const onComplete = vi.fn();
  renderWithProviders(
    <RestoreWizard
      open
      settings={SETTINGS}
      defaultDestination="C:\\Users\\test\\profiles"
      onDismiss={onDismiss}
      onComplete={onComplete}
      {...overrides}
    />,
  );
  return { onDismiss, onComplete };
}

beforeEach(() => {
  backupListMock.mockReset();
  backupVersionsMock.mockReset();
  backupListMock.mockResolvedValue({ backups: [BACKUP] });
  backupVersionsMock.mockResolvedValue({ versions: [VERSION] });
});

describe('RestoreWizard', () => {
  it('renders as a proper dialog (role=dialog), not a bare overlay div', async () => {
    renderWizard();
    // The fix: shadcn Dialog yields role=dialog. The old hand-rolled
    // `fixed inset-0` <div> had no role, so this assertion would have failed.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows the title, backup name, and Restore action once loaded', async () => {
    renderWizard();
    expect(
      await screen.findByText('Restore on this machine'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('hugo-desktop')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /^restore$/i }),
    ).toBeInTheDocument();
  });

  it('renders nothing when open is false', () => {
    renderWizard({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('re-fetches the backup list on every reopen', async () => {
    const props = {
      settings: SETTINGS,
      defaultDestination: 'C:\\Users\\test\\profiles',
      onDismiss: vi.fn(),
      onComplete: vi.fn(),
    };
    const { rerender } = renderWithProviders(
      <RestoreWizard open={false} {...props} />,
    );

    rerender(<RestoreWizard open {...props} />);
    expect(await screen.findByText('hugo-desktop')).toBeInTheDocument();
    expect(backupListMock).toHaveBeenCalledTimes(1);

    // Close, then reopen — the list must be fetched again, not reused.
    rerender(<RestoreWizard open={false} {...props} />);
    rerender(<RestoreWizard open {...props} />);
    await waitFor(() => expect(backupListMock).toHaveBeenCalledTimes(2));
  });

  it('does not show a stale count when the list emptied between opens', async () => {
    const onDismiss = vi.fn();
    const props = {
      settings: SETTINGS,
      defaultDestination: 'C:\\Users\\test\\profiles',
      onDismiss,
      onComplete: vi.fn(),
    };
    const { rerender } = renderWithProviders(
      <RestoreWizard open={false} {...props} />,
    );

    // First open: one backup present.
    rerender(<RestoreWizard open {...props} />);
    expect(await screen.findByText('hugo-desktop')).toBeInTheDocument();

    // The account is emptied (e.g. the only backup was deleted), then reopen.
    rerender(<RestoreWizard open={false} {...props} />);
    backupListMock.mockResolvedValue({ backups: [] });
    rerender(<RestoreWizard open {...props} />);

    // The refetch returns empty → polite dismiss, and the stale "1 backup"
    // copy must never be shown over the now-empty account.
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(screen.queryByText(/We found 1 backup\b/)).not.toBeInTheDocument();
  });
});
