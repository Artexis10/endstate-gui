/**
 * Regression: the in-pane "Restore" must guard the native save dialog.
 *
 * `handleRestore` awaits `saveDialog()` before its try/catch. The native
 * dialog can *reject* when it cannot be presented (e.g. outside the Tauri
 * shell, as in the standalone dev bridge). Without a guard that reject
 * escapes as an unhandled promise rejection. This pins the friendly-toast
 * behavior. Mirrors the same guard tested in restore-wizard.test.tsx.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { BackupPane } from './backup-pane';
import type { AppSettings } from '@/settings';
import type { BackupListItem, BackupStatusData } from '@/types';

vi.mock('@/lib/backup-bridge', () => {
  class BackupCommandError extends Error {
    code: string;
    constructor(args: { code: string; message: string }) {
      super(args.message);
      this.code = args.code;
    }
  }
  return {
    backupStatus: vi.fn().mockResolvedValue({
      signedIn: true,
      subscriptionStatus: 'active',
      issuerUrl: 'https://substratesystems.io',
    }),
    backupList: vi.fn().mockResolvedValue({ backups: [] }),
    backupVersions: vi.fn().mockResolvedValue({ backupId: 'b1', versions: [] }),
    backupPull: vi.fn(),
    BackupCommandError,
  };
});

import { backupPull, backupList, backupVersions } from '@/lib/backup-bridge';
const backupPullMock = vi.mocked(backupPull);
const backupListMock = vi.mocked(backupList);
const backupVersionsMock = vi.mocked(backupVersions);

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
const saveDialogMock = vi.mocked(saveDialog);

// Toasts render through sonner's portal (not mounted in jsdom) — assert on
// the showToast call instead of DOM text.
const { showToastSpy } = vi.hoisted(() => ({ showToastSpy: vi.fn() }));
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>(
    '@/components/ui/toast',
  );
  return { ...actual, useToast: () => ({ showToast: showToastSpy }) };
});

const SETTINGS = { autoBackupEnabled: false } as unknown as AppSettings;

const STATUS: BackupStatusData = {
  signedIn: true,
  email: 'test@substratesystems.io',
  subscriptionStatus: 'active',
  issuerUrl: 'https://substratesystems.io',
  quotaUsedBytes: 1000,
  quotaTotalBytes: 1_000_000,
  versionCount: 1,
} as unknown as BackupStatusData;

const BACKUP: BackupListItem = {
  id: 'b-1',
  name: 'This computer',
  latestVersionId: 'v-1',
  versionCount: 1,
  totalSize: 1000,
  updatedAt: '2026-06-04T08:37:18.709Z',
} as unknown as BackupListItem;

beforeEach(() => {
  saveDialogMock.mockReset();
  backupPullMock.mockReset();
  showToastSpy.mockReset();
  // The pane revalidates in the background (stale-while-revalidate); keep the
  // list non-empty so the backup card (with its Restore button) stays mounted.
  backupListMock.mockResolvedValue({ backups: [BACKUP] });
  backupVersionsMock.mockResolvedValue({
    backupId: 'b-1',
    versions: [
      {
        versionId: 'v-1',
        createdAt: '2026-06-04T08:37:18.709Z',
        size: 1000,
        manifestSha256: 'abc',
      },
    ],
  } as unknown as Awaited<ReturnType<typeof backupVersions>>);
});

describe('BackupPane in-pane restore', () => {
  it('shows a friendly toast (not an unhandled rejection) when the save dialog fails to open', async () => {
    saveDialogMock.mockRejectedValueOnce(new Error('no dialog available'));
    renderWithProviders(
      <BackupPane
        settings={SETTINGS}
        selectedProfilePath={null}
        selectedProfileName={null}
        initialStatus={STATUS}
        initialBackups={[BACKUP]}
      />,
    );

    const restore = await screen.findByRole('button', { name: /^restore$/i });
    await userEvent.click(restore);

    await waitFor(() =>
      expect(showToastSpy).toHaveBeenCalledWith(
        expect.stringMatching(/could not open the save dialog/i),
        'error',
      ),
    );
    // The pull must never start when no destination was chosen.
    expect(backupPullMock).not.toHaveBeenCalled();
  });
});
