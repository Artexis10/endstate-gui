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

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, CloudOff, WifiOff } from 'lucide-react';
import { SubscriptionBanner } from './subscription-banner';
import { BackupList } from './backup-list';
import { BackupListEmpty } from './backup-list-empty';
import { QuotaMeter } from './quota-meter';
import { QuotaNotice } from './quota-notice';
import { LastSyncIndicator } from './last-sync-indicator';
import { VersionList } from './version-list';
import { PushProgressDialog } from './push-progress-dialog';
import { PullProgressDialog } from './pull-progress-dialog';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { usePrePushGuard } from './use-pre-push-guard';
import { useBackupState } from './use-backup-state';
import {
  backupDelete,
  backupDeleteVersion,
  backupPush,
  backupPull,
  backupSubscribe,
  backupBrowserSession,
  BackupCommandError,
} from '@/lib/backup-bridge';
import {
  friendlyBackupError,
  isNetworkErrorCode,
  type FriendlyBackupErrorCtaAction,
} from '@/lib/backup-errors';
import type { AppSettings } from '@/settings';
import type { BackupListItem, BackupStatusData } from '@/types';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { hasSeenFirstPushFor, markFirstPushFor } from '@/lib/first-push-flag';

export interface BackupPaneProps {
  settings: AppSettings;
  /** Absolute path to the profile JSON file the user wants to push. */
  selectedProfilePath: string | null;
  selectedProfileName: string | null;
  /** Called when the engine reports AUTH_REQUIRED — session expired/revoked.
   *  Parent should clear hosted-backup state and route back to the disclosure
   *  / sign-in flow with a calm toast. */
  onAuthLost?: () => void;
  /** Pre-fetched status from the parent. When set the pane skips its own
   *  mount-time status fetch (one less subprocess spawn). */
  initialStatus?: BackupStatusData | null;
  /** Pre-fetched backup list from the parent's boot prefetch. When set,
   *  the pane renders the cached list immediately and revalidates in the
   *  background (stale-while-revalidate). */
  initialBackups?: BackupListItem[] | null;
  /** Route to the Setup flow ("capture this computer"). The pane uses this
   *  to power the post-claim empty state's primary CTA. The pane does not
   *  navigate on its own — App.tsx wires this to its existing setup-flow
   *  entry point. */
  onRequestCapture?: () => void;
  /** Thunk reading whether the parent's re-auth dialog is currently open.
   *  Forwarded to `useBackupState` so a silent focus refresh hitting
   *  AUTH_REQUIRED while the dialog is already open drops the event instead
   *  of re-firing `onAuthLost` and stacking dialogs. */
  isReauthOpen?: () => boolean;
  /** Automatic backup is paused because a background push hit AUTH_REQUIRED.
   *  Flips the last-sync indicator to an actionable "Sign in to resume" state. */
  autoBackupPaused?: boolean;
  /** Opens the inline re-auth dialog from the paused indicator. */
  onResumeAutoBackup?: () => void;
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
  onAuthLost,
  initialStatus,
  initialBackups,
  onRequestCapture,
  isReauthOpen,
  autoBackupPaused,
  onResumeAutoBackup,
}: BackupPaneProps) {
  const state = useBackupState(settings, {
    onAuthLost,
    initialStatus,
    initialBackups,
    isReauthOpen,
  });
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [managePending, setManagePending] = useState(false);
  // Ref-mirror so the click handler can guard re-entry synchronously (state
  // updates are batched and would let a fast double-click slip through).
  const managePendingRef = useRef(false);

  // Track mount so the AUTH_REQUIRED path (which triggers parent unmount via
  // `onAuthLost`) doesn't schedule setCheckoutPending(false) on an unmounted
  // component. React 18 silently ignores it, but the guard removes the wart.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const subscriptionStatus = state.status?.subscriptionStatus ?? 'none';
  const canWrite = subscriptionStatus === 'active';
  const canRestore = subscriptionStatus !== 'none';
  const canDelete = subscriptionStatus !== 'none';

  // Subscribe / Renew: the engine returns a checkout-transaction URL and we
  // open it in the system browser. The payment overlay renders on substrate's
  // /endstate landing — never in-app (hosted-backup contract §7). Guarded
  // against double-mint via checkoutPending.
  const handleCheckout = useCallback(async () => {
    setCheckoutPending(true);
    try {
      const { checkoutUrl } = await backupSubscribe(settings);
      await openExternal(checkoutUrl);
    } catch (err) {
      if (err instanceof BackupCommandError && err.code === 'AUTH_REQUIRED') {
        onAuthLost?.();
        return;
      }
      if (err instanceof BackupCommandError) {
        const f = friendlyBackupError(err);
        showToast(f.headline, f.tone);
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      if (mountedRef.current) setCheckoutPending(false);
    }
  }, [settings, onAuthLost, showToast]);

  // Manage subscription (active / grace / cancelled): mint a short-lived
  // Account Portal handoff token via the engine, then open the substrate
  // `/account/start?session=<jwt>` URL externally. Substrate swaps the JWT
  // for an HttpOnly cookie and 302s to the cookie-only `/account` page.
  // See hosted-backup contract §5 and the Endstate Account Portal
  // Architecture decision (2026-05-26).
  //
  // Failure modes mirror handleCheckout above:
  //   - AUTH_REQUIRED → onAuthLost (session expired between status + click)
  //   - other engine error → friendlyBackupError + toast (BACKEND_UNREACHABLE,
  //     SUBSCRIPTION_REQUIRED edge cases, etc.)
  //
  // Double-click is guarded by `managePending` (set during the engine call;
  // openExternal returns immediately so the guard mostly covers the engine
  // round-trip, which is the slow part).
  const handleManage = useCallback(async () => {
    if (managePendingRef.current) return;
    managePendingRef.current = true;
    setManagePending(true);
    try {
      const { sessionToken, accountUrl } = await backupBrowserSession(settings);
      const url = new URL(accountUrl);
      url.searchParams.set('session', sessionToken);
      await openExternal(url.toString());
    } catch (err) {
      if (err instanceof BackupCommandError && err.code === 'AUTH_REQUIRED') {
        onAuthLost?.();
        return;
      }
      if (err instanceof BackupCommandError) {
        const f = friendlyBackupError(err);
        showToast(f.headline, f.tone);
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      if (mountedRef.current) setManagePending(false);
      managePendingRef.current = false;
    }
  }, [settings, onAuthLost, showToast]);

  const { guardPush, dialog: prePushDialog } = usePrePushGuard(settings, state.status);

  const runPush = useCallback(
    async (profile: string, backupId?: string) => {
      state.resetPushProgress();
      state.setPushOpen(true);
      try {
        await backupPush(settings, {
          profile,
          backupId,
          name: backupId ? undefined : selectedProfileName ?? undefined,
          onEvent: state.pushOnEvent,
        });
        const email = state.status?.email;
        if (!hasSeenFirstPushFor(email)) {
          showToast(
            'First backup saved to the cloud. Your settings are now safe across machines.',
            'success',
          );
          markFirstPushFor(email);
        } else {
          showToast('Backup uploaded.', 'success');
        }
        state.setPushOpen(false);
        await state.refresh();
        if (state.selectedBackupId) {
          await state.refreshVersions(state.selectedBackupId);
        }
      } catch (err) {
        state.setPushOpen(false);
        if (err instanceof BackupCommandError) {
          const f = friendlyBackupError(err);
          showToast(f.headline, f.tone);
        } else {
          showToast(err instanceof Error ? err.message : String(err), 'error');
        }
      }
    },
    [selectedProfileName, settings, state, showToast],
  );

  // Manual push → soft-warn first if it would approach/exceed quota, then push.
  const handlePush = useCallback(
    async (backupId?: string) => {
      if (!selectedProfilePath) {
        showToast('Select a profile first to push.', 'warning');
        return;
      }
      await guardPush({ profile: selectedProfilePath, backupId }, () =>
        runPush(selectedProfilePath, backupId),
      );
    },
    [selectedProfilePath, guardPush, runPush, showToast],
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
          const f = friendlyBackupError(err);
          showToast(f.headline, f.tone);
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
        const f = friendlyBackupError(err);
        showToast(f.headline, f.tone);
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, settings, showToast, state]);

  // Map the engine-side error to a friendly headline/body/CTA before render.
  // The mapper strips CLI-jargon remediation and routes the CTA to one of
  // retry / reauth / manage-billing / dismiss. The icon flips to WifiOff only
  // when the code is genuinely network-class AND we have no signed-in status
  // (a follow-up list/versions failure after a successful status fetch is
  // most likely transient — claiming "can't reach servers" would contradict
  // the signed-in chip).
  //
  // Hook order: this useCallback must stay above any early return so React's
  // hook order is stable across renders (loading → loaded flip would otherwise
  // change the hook count and crash the component).
  const runCta = useCallback(
    (action: FriendlyBackupErrorCtaAction) => {
      switch (action) {
        case 'reauth':
          onAuthLost?.();
          return;
        case 'manage-billing':
          void handleManage();
          return;
        case 'retry':
        case 'dismiss':
        default:
          void state.refresh();
          return;
      }
    },
    [onAuthLost, handleManage, state],
  );

  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading backup status…
      </div>
    );
  }

  const errorView = state.error ? (
    (() => {
      const f = friendlyBackupError(state.error);
      const showNetworkIcon =
        !state.status && isNetworkErrorCode(state.error.code);
      const Icon = showNetworkIcon ? WifiOff : CloudOff;
      const cta = f.cta ?? { label: 'Try again', action: 'retry' as const };
      return (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card p-6 text-center shadow-sm"
          data-testid="backup-pane-error"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold">{f.headline}</h3>
          {f.body && (
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => runCta(cta.action)}
              data-testid="backup-pane-retry"
            >
              {cta.label}
            </Button>
          </div>
        </div>
      );
    })()
  ) : null;

  // Status itself failed — we can't render the signed-in pane (no chip,
  // banner, or list data). Centre the error card in the pane.
  if (state.error && !state.status) {
    return <div className="flex items-center justify-center p-12">{errorView}</div>;
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
      <SubscriptionBanner
        status={subscriptionStatus}
        graceEndsAt={state.status.graceEndsAt}
        onCheckout={handleCheckout}
        checkoutPending={checkoutPending}
        onManage={handleManage}
        managePending={managePending}
      />

      <QuotaNotice
        quotaUsedBytes={state.status.quotaUsedBytes}
        quotaTotalBytes={state.status.quotaTotalBytes}
      />

      <QuotaMeter
        quotaUsedBytes={state.status.quotaUsedBytes}
        quotaTotalBytes={state.status.quotaTotalBytes}
        versionCount={state.status.versionCount}
      />

      <LastSyncIndicator
        lastBackupAt={state.status.lastBackupAt}
        authPaused={autoBackupPaused}
        onResumeClick={onResumeAutoBackup}
      />

      {state.status.keychainError && (
        <div
          role="alert"
          className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"
        >
          Saved session is read-only this session: {state.status.keychainError}
        </div>
      )}

      {errorView ?? (
        state.backups.length === 0 ? (
          <BackupListEmpty
            subscriptionStatus={subscriptionStatus}
            onCapture={onRequestCapture}
            onPushExisting={
              canWrite && selectedProfilePath
                ? () => handlePush(undefined)
                : undefined
            }
            selectedProfileName={selectedProfileName}
          />
        ) : (
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
        )
      )}

      {!errorView && selectedBackup && (
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
        retryState={state.pushProgress.retryState}
      />

      <PullProgressDialog
        open={state.pullOpen}
        totalChunks={state.pullProgress.totalChunks}
        downloadedChunks={state.pullProgress.downloadedChunks}
        verifiedChunks={state.pullProgress.verifiedChunks}
        decryptedChunks={state.pullProgress.decryptedChunks}
        subPhase={state.pullProgress.subPhase}
        currentChunkIndex={state.pullProgress.currentChunkIndex}
        retryState={state.pullProgress.retryState}
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

      {prePushDialog}
    </div>
  );
}

// Re-export so callers (e.g. App.tsx) can prefetch openExternal usage paths
// as a mock surface in tests; not used at runtime here.
export const __testInternals = { openExternal };
