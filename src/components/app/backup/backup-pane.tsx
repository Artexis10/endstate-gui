/**
 * Backup pane — the main hosted-backup screen for signed-in users.
 *
 * Wires:
 *   - subscription banner (state-driven banner + Subscribe/Manage links)
 *   - backup list (with push/restore/delete actions, gated by subscription
 *     state per contract §10)
 *   - version list (per-backup, with restore/delete-version)
 *   - streaming push/pull progress dialogs
 *   - delete confirmation modal (reused for backup + version)
 *
 * Subscription gating rules (contract §10):
 *   - Write (push, restore-write) blocked unless `active`
 *   - Read (restore) allowed in `active`/`grace`/`cancelled`
 *   - Delete allowed in any non-`none` state (kindness exception)
 *
 * Restore-from-backup-pane (vs the new-machine wizard): same end action
 * (`backupPull`) but always picks the user's destination via the dialog
 * plugin's save dialog. Caller passes `onRequestRestore(backupId)` /
 * `onRequestRestoreVersion(backupId, versionId)` so this pane stays focused
 * on rendering and the higher-level wizard can hand off cleanly.
 */

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { SubscriptionBanner } from './subscription-banner';
import { BackupList } from './backup-list';
import { VersionList } from './version-list';
import { PushProgressDialog } from './push-progress-dialog';
import { PullProgressDialog } from './pull-progress-dialog';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { useBackupState } from './use-backup-state';
import {
  backupDelete,
  backupDeleteVersion,
  backupPush,
  backupPull,
  BackupCommandError,
} from '@/lib/backup-bridge';
import type { AppSettings } from '@/settings';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

export interface BackupPaneProps {
  settings: AppSettings;
  /** Absolute path to the profile JSON file the user wants to push. */
  selectedProfilePath: string | null;
  selectedProfileName: string | null;
}

interface DeleteTarget {
  kind: 'backup' | 'version';
  backupId: string;
  versionId?: string;
  label: string;
}

export function BackupPane({
  settings,
  selectedProfilePath,
  selectedProfileName,
}: BackupPaneProps) {
  const state = useBackupState(settings);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const subscriptionStatus = state.status?.subscriptionStatus ?? 'none';
  const canWrite = subscriptionStatus === 'active';
  const canRestore = subscriptionStatus !== 'none';
  const canDelete = subscriptionStatus !== 'none';

  const handlePush = useCallback(
    async (backupId: string) => {
      if (!selectedProfilePath) {
        showToast('Select a profile first to push.', 'warning');
        return;
      }
      state.resetPushProgress();
      state.setPushOpen(true);
      try {
        await backupPush(settings, {
          profile: selectedProfilePath,
          backupId,
          onEvent: state.pushOnEvent,
        });
        showToast('Backup uploaded.', 'success');
        state.setPushOpen(false);
        await state.refresh();
        if (state.selectedBackupId) {
          await state.refreshVersions(state.selectedBackupId);
        }
      } catch (err) {
        state.setPushOpen(false);
        if (err instanceof BackupCommandError) {
          showToast(err.message, 'error');
        } else {
          showToast(err instanceof Error ? err.message : String(err), 'error');
        }
      }
    },
    [selectedProfilePath, settings, state, showToast],
  );

  const handleRestore = useCallback(
    async (backupId: string, versionId?: string) => {
      const target = await saveDialog({
        title: 'Choose where to restore',
        defaultPath: selectedProfileName ?? 'restored-profile.json',
        filters: [{ name: 'Endstate profile', extensions: ['json', 'jsonc'] }],
      });
      if (!target) return; // user cancelled
      state.resetPullProgress();
      state.setPullOpen(true);
      try {
        const result = await backupPull(settings, {
          backupId,
          versionId,
          to: target,
          overwrite: true,
          onEvent: state.pullOnEvent,
        });
        state.setPullOpen(false);
        showToast(`Profile restored to ${result.writtenTo}`, 'success');
      } catch (err) {
        state.setPullOpen(false);
        if (err instanceof BackupCommandError) {
          showToast(err.message, 'error');
        } else {
          showToast(err instanceof Error ? err.message : String(err), 'error');
        }
      }
    },
    [settings, selectedProfileName, state, showToast],
  );

  const handleDelete = useCallback(
    (backupId: string) => {
      const backup = state.backups.find((b) => b.id === backupId);
      setDeleteTarget({
        kind: 'backup',
        backupId,
        label: backup?.name ?? backupId,
      });
    },
    [state.backups],
  );

  const handleDeleteVersion = useCallback((backupId: string, versionId: string) => {
    setDeleteTarget({
      kind: 'version',
      backupId,
      versionId,
      label: versionId.slice(0, 8),
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'backup') {
        await backupDelete(settings, { backupId: deleteTarget.backupId });
        showToast(`Deleted backup “${deleteTarget.label}”.`, 'success');
        await state.refresh();
      } else if (deleteTarget.versionId) {
        await backupDeleteVersion(settings, {
          backupId: deleteTarget.backupId,
          versionId: deleteTarget.versionId,
        });
        showToast('Version deleted.', 'success');
        await state.refreshVersions(deleteTarget.backupId);
      }
    } catch (err) {
      if (err instanceof BackupCommandError) {
        showToast(err.message, 'error');
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, settings, showToast, state]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading backup status…
      </div>
    );
  }

  if (state.error) {
    return (
      <div
        role="alert"
        className="m-6 rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-foreground"
      >
        <p className="font-medium">Could not load backup status.</p>
        <p className="text-xs text-muted-foreground">{state.error}</p>
        <div className="mt-3">
          <Button type="button" variant="ghost" onClick={() => state.refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!state.status?.signedIn) {
    return (
      <div className="m-6 text-sm text-muted-foreground" data-testid="backup-pane-signed-out">
        Sign in to view your hosted backups.
      </div>
    );
  }

  const selectedBackup = state.backups.find((b) => b.id === state.selectedBackupId);

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="backup-pane">
      <SubscriptionBanner status={subscriptionStatus} />

      {state.status.keychainError && (
        <div
          role="alert"
          className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"
        >
          Saved session is read-only this session: {state.status.keychainError}
        </div>
      )}

      <BackupList
        backups={state.backups}
        canWrite={canWrite && !!selectedProfilePath}
        canRestore={canRestore}
        canDelete={canDelete}
        onPush={handlePush}
        onRestore={(id) => handleRestore(id)}
        onDelete={handleDelete}
        onSelect={(id) => state.setSelectedBackupId(id)}
        selectedBackupId={state.selectedBackupId}
      />

      {selectedBackup && (
        <section aria-label={`Versions of ${selectedBackup.name}`} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Versions</h3>
          <VersionList
            versions={state.versions}
            canRestore={canRestore}
            canDelete={canDelete}
            onRestoreVersion={(versionId) =>
              handleRestore(selectedBackup.id, versionId)
            }
            onDeleteVersion={(versionId) =>
              handleDeleteVersion(selectedBackup.id, versionId)
            }
          />
        </section>
      )}

      <PushProgressDialog
        open={state.pushOpen}
        totalChunks={state.pushProgress.totalChunks}
        uploadedChunks={state.pushProgress.uploadedChunks}
        currentChunkIndex={state.pushProgress.currentChunkIndex}
      />

      <PullProgressDialog
        open={state.pullOpen}
        totalChunks={state.pullProgress.totalChunks}
        downloadedChunks={state.pullProgress.downloadedChunks}
        verifiedChunks={state.pullProgress.verifiedChunks}
        decryptedChunks={state.pullProgress.decryptedChunks}
        subPhase={state.pullProgress.subPhase}
        currentChunkIndex={state.pullProgress.currentChunkIndex}
      />

      <DeleteConfirmationModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.kind === 'backup'
            ? `Delete “${deleteTarget?.label}”?`
            : `Delete version ${deleteTarget?.label}?`
        }
        description={
          deleteTarget?.kind === 'backup'
            ? 'This permanently deletes the backup and all its versions. This cannot be undone.'
            : 'This deletes a single version. The version is purged after a 7-day grace window.'
        }
        confirmLabel={
          deleteTarget?.kind === 'backup' ? 'Delete backup' : 'Delete version'
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// Re-export so callers (e.g. App.tsx) can prefetch openExternal usage paths
// as a mock surface in tests; not used at runtime here.
export const __testInternals = { openExternal };
