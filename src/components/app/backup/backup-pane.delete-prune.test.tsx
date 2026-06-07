/**
 * Deleting a backup must notify the parent (onBackupDeleted) so it can prune
 * the local profile→backupId mapping. Without this, the stale id lingers and a
 * later "Back up to cloud" would push to a dead --backup-id. Pairs with the
 * pure-logic tests in src/lib/cloud-hosting.test.ts (verify + prune).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { within } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
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
    backupList: vi.fn(),
    backupVersions: vi.fn().mockResolvedValue({ backupId: 'b-1', versions: [] }),
    backupDelete: vi.fn().mockResolvedValue(undefined),
    backupDeleteVersion: vi.fn().mockResolvedValue(undefined),
    BackupCommandError,
  };
});

import { backupList, backupDelete } from '@/lib/backup-bridge';
const backupListMock = vi.mocked(backupList);
const backupDeleteMock = vi.mocked(backupDelete);

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));

const { showToastSpy } = vi.hoisted(() => ({ showToastSpy: vi.fn() }));
vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/toast')>(
    '@/components/ui/toast',
  );
  return { ...actual, useToast: () => ({ showToast: showToastSpy }) };
});

const SETTINGS = {
  autoBackupEnabled: false,
  profileBackupIds: { 'C:\\p\\work.jsonc': 'b-1' },
} as unknown as AppSettings;

const STATUS = {
  signedIn: true,
  email: 'test@substratesystems.io',
  subscriptionStatus: 'active',
  issuerUrl: 'https://substratesystems.io',
  quotaUsedBytes: 1000,
  quotaTotalBytes: 1_000_000,
  versionCount: 1,
} as unknown as BackupStatusData;

const BACKUP = {
  id: 'b-1',
  name: 'work',
  latestVersionId: 'v-1',
  versionCount: 1,
  totalSize: 1000,
  updatedAt: '2026-06-04T08:37:18.709Z',
} as unknown as BackupListItem;

beforeEach(() => {
  backupListMock.mockReset();
  backupDeleteMock.mockReset();
  showToastSpy.mockReset();
  backupListMock.mockResolvedValue({ backups: [BACKUP] });
  backupDeleteMock.mockResolvedValue({ backupId: 'b-1', deleted: true });
});

describe('BackupPane delete → onBackupDeleted', () => {
  it('fires onBackupDeleted with the deleted id so the parent can prune the mapping', async () => {
    const onBackupDeleted = vi.fn();
    renderWithProviders(
      <BackupPane
        settings={SETTINGS}
        selectedProfilePath={null}
        selectedProfileName={null}
        initialStatus={STATUS}
        initialBackups={[BACKUP]}
        onBackupDeleted={onBackupDeleted}
      />,
    );

    // Open the delete confirmation from the backup row.
    const rowDelete = await screen.findByRole('button', { name: /^delete backup$/i });
    await userEvent.click(rowDelete);

    // Confirm inside the dialog (the row button shares its label).
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^delete backup$/i }),
    );

    await waitFor(() =>
      expect(backupDeleteMock).toHaveBeenCalledWith(expect.anything(), {
        backupId: 'b-1',
      }),
    );
    expect(onBackupDeleted).toHaveBeenCalledWith('b-1');
  });
});
