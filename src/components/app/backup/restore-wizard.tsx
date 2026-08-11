/**
 * Restore-on-new-machine wizard.
 *
 * Triggered after a successful sign-in when:
 *   - the user has at least one remote backup, AND
 *   - their local profiles directory is empty
 *
 * The detection happens in App.tsx; this component just renders the wizard
 * given a non-empty backup list. The wizard is distinct from the in-pane
 * "Restore" action — same end action (`backupPull`) but with a focused UX
 * for the cold-start case.
 *
 * Three steps: choose backup/version → choose destination → progress → done.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { invoke } from '@/lib/tauri-bridge';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import {
  backupList,
  backupVersions,
  backupPull,
  BackupCommandError,
} from '@/lib/backup-bridge';
import { friendlyBackupError } from '@/lib/backup-errors';
import { isPhaseEvent, isBackupChunkEvent } from '@/lib/streaming-events';
import type { StreamingEvent } from '@/lib/streaming-events';
import { PullProgressDialog } from './pull-progress-dialog';
import type {
  BackupListItem,
  BackupVersionItem,
} from '@/types';
import type { AppSettings } from '@/settings';
import { Loader2, FolderOpen } from 'lucide-react';

export interface RestoreWizardProps {
  open: boolean;
  settings: AppSettings;
  providerKind?: 'endstate-cloud' | 'self-hosted' | 'unknown';
  /** Suggested default destination (typically the user's profiles directory). */
  defaultDestination: string;
  onDismiss: () => void;
  /** Called when the user finishes the wizard. `backupId` is the backup the
   *  profile was restored from, so the caller can record the local→cloud link
   *  (so the restored profile reads as "Backed up", not "Local only"). */
  onComplete: (writtenTo: string, backupId: string) => void;
}

type Step = 'choose' | 'progress' | 'done';

export function RestoreWizard({
  open,
  settings,
  providerKind = 'endstate-cloud',
  defaultDestination,
  onDismiss,
  onComplete,
}: RestoreWizardProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [versionsByBackup, setVersionsByBackup] = useState<
    Record<string, BackupVersionItem[]>
  >({});
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState({
    totalChunks: 0,
    downloadedChunks: 0,
    verifiedChunks: 0,
    decryptedChunks: 0,
    subPhase: 'idle' as 'idle' | 'downloading' | 'verifying' | 'decrypting',
    currentChunkIndex: null as number | null,
  });
  const [completionPath, setCompletionPath] = useState<string | null>(null);

  // Reset wizard state on every closed→open transition so a reopen always starts
  // from a clean loading state and re-fetches. The component stays mounted across
  // opens (its `open` prop is toggled from App.tsx), so without this it would
  // render its previous `backups`/`loading` for a frame — surfacing a stale
  // "We found N backups" count after the underlying list changed (e.g. a delete
  // emptied the account). This is React's "adjust state during render" pattern,
  // so the stale frame is never painted; the effect below then refetches.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('choose');
      setLoading(true);
      setBackups([]);
      setVersionsByBackup({});
      setSelectedBackupId(null);
      setSelectedVersionId(null);
    }
  }

  // Load backup + version list on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await backupList(settings);
        if (cancelled) return;
        setBackups(list.backups);
        if (list.backups.length === 0) {
          // No remote backups — caller should not have opened the wizard.
          // Dismiss politely.
          setLoading(false);
          onDismiss();
          return;
        }
        const first = list.backups[0];
        setSelectedBackupId(first.id);
        const versions = await backupVersions(settings, first.id);
        if (cancelled) return;
        setVersionsByBackup({ [first.id]: versions.versions });
        setSelectedVersionId(versions.versions[0]?.versionId ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof BackupCommandError) {
          const f = friendlyBackupError(err, { providerKind });
          showToast(f.headline, f.tone);
        } else {
          showToast(err instanceof Error ? err.message : String(err), 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, settings, onDismiss, showToast]);

  const versions = useMemo(
    () => (selectedBackupId ? versionsByBackup[selectedBackupId] ?? [] : []),
    [selectedBackupId, versionsByBackup],
  );

  const handlePickBackup = async (backupId: string) => {
    setSelectedBackupId(backupId);
    if (!versionsByBackup[backupId]) {
      try {
        const data = await backupVersions(settings, backupId);
        setVersionsByBackup((prev) => ({ ...prev, [backupId]: data.versions }));
        setSelectedVersionId(data.versions[0]?.versionId ?? null);
      } catch (err) {
        if (err instanceof BackupCommandError) {
          const f = friendlyBackupError(err, { providerKind });
          showToast(f.headline, f.tone);
        } else {
          showToast(err instanceof Error ? err.message : String(err), 'error');
        }
      }
    } else {
      setSelectedVersionId(versionsByBackup[backupId][0]?.versionId ?? null);
    }
  };

  const handleStartRestore = async () => {
    if (!selectedBackupId || !selectedVersionId) return;
    let target: string | null;
    try {
      target = await saveDialog({
        title: 'Choose where to restore',
        defaultPath: `${defaultDestination}\\restored.profile.json`,
        filters: [{ name: 'Endstate profile', extensions: ['json', 'jsonc'] }],
      });
    } catch {
      // The native save dialog can fail to present (e.g. outside the Tauri
      // shell). Surface a friendly toast rather than leaking an unhandled
      // promise rejection.
      showToast('Could not open the save dialog. Please try again.', 'error');
      return;
    }
    if (!target) return;
    setStep('progress');
    setPullProgress({
      totalChunks: 0,
      downloadedChunks: 0,
      verifiedChunks: 0,
      decryptedChunks: 0,
      subPhase: 'idle',
      currentChunkIndex: null,
    });
    try {
      const result = await backupPull(settings, {
        backupId: selectedBackupId,
        versionId: selectedVersionId,
        to: target,
        overwrite: true,
        onEvent: (event: StreamingEvent) => {
          if (isPhaseEvent(event) && event.phase === 'backup-pull') {
            setPullProgress({
              totalChunks: 0,
              downloadedChunks: 0,
              verifiedChunks: 0,
              decryptedChunks: 0,
              subPhase: 'idle',
              currentChunkIndex: null,
            });
            return;
          }
          if (!isBackupChunkEvent(event)) return;
          setPullProgress((prev) => {
            const totalChunks = event.totalChunks > 0 ? event.totalChunks : prev.totalChunks;
            switch (event.status) {
              case 'downloading':
                return {
                  ...prev,
                  totalChunks,
                  subPhase: 'downloading',
                  currentChunkIndex: event.chunkIndex,
                };
              case 'verified':
                return {
                  ...prev,
                  totalChunks,
                  downloadedChunks: prev.downloadedChunks + 1,
                  verifiedChunks: prev.verifiedChunks + 1,
                  subPhase: 'verifying',
                  currentChunkIndex: event.chunkIndex,
                };
              case 'decrypted':
                return {
                  ...prev,
                  totalChunks,
                  decryptedChunks: prev.decryptedChunks + 1,
                  subPhase: 'decrypting',
                  currentChunkIndex: null,
                };
              default:
                return { ...prev, totalChunks };
            }
          });
        },
      });
      setCompletionPath(result.writtenTo);
      setStep('done');
    } catch (err) {
      if (err instanceof BackupCommandError) {
        const f = friendlyBackupError(err, { providerKind });
        showToast(f.headline, f.tone);
      } else {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
      setStep('choose');
    }
  };

  if (!open) return null;

  // While the pull runs, show only PullProgressDialog (its own modal) so we
  // never stack two overlays. Choose/done render inside the wizard dialog.
  if (step === 'progress') {
    return (
      <PullProgressDialog
        open
        totalChunks={pullProgress.totalChunks}
        downloadedChunks={pullProgress.downloadedChunks}
        verifiedChunks={pullProgress.verifiedChunks}
        decryptedChunks={pullProgress.decryptedChunks}
        subPhase={pullProgress.subPhase}
        currentChunkIndex={pullProgress.currentChunkIndex}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Restore on this machine</DialogTitle>
          <DialogDescription>
            We found {backups.length} backup{backups.length === 1 ? '' : 's'} under your
            account. Pick one to restore here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading backups…
            </div>
          ) : step === 'choose' ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium mb-1">Backup</legend>
                <RadioGroup
                  value={selectedBackupId ?? undefined}
                  onValueChange={handlePickBackup}
                  aria-label="Backup"
                >
                  {backups.map((b) => (
                    <label
                      key={b.id}
                      className={
                        'flex items-center gap-3 rounded-md border p-2 cursor-pointer ' +
                        (selectedBackupId === b.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border')
                      }
                    >
                      <RadioGroupItem value={b.id} />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{b.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.versionCount} version{b.versionCount === 1 ? '' : 's'} ·
                          updated {new Date(b.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium mb-1">Version</legend>
                {versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No versions for this backup.
                  </p>
                ) : (
                  <Select
                    value={selectedVersionId ?? undefined}
                    onValueChange={(v) => setSelectedVersionId(v || null)}
                  >
                    <SelectTrigger aria-label="Backup version">
                      <SelectValue placeholder="Select a version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.versionId} value={v.versionId}>
                          {new Date(v.createdAt).toLocaleString()} (
                          {v.versionId.slice(0, 8)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </fieldset>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={onDismiss}>
                  Skip for now
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleStartRestore}
                  disabled={!selectedBackupId || !selectedVersionId}
                >
                  Restore
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                <p className="font-medium">Restore complete.</p>
                <p className="text-xs text-muted-foreground">
                  Profile written to{' '}
                  <code className="font-mono">{completionPath}</code>
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    if (!completionPath) return;
                    // Open the parent folder of the restored file.
                    const parentDir = completionPath.replace(/[\\/][^\\/]+$/, '');
                    try {
                      await invoke('open_folder', { path: parentDir });
                    } catch {
                      // Fall back to opening the file URL externally.
                      try {
                        await openExternal(`file:///${parentDir}`);
                      } catch {
                        // ignore
                      }
                    }
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                  Open the restored folder
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    if (completionPath && selectedBackupId) {
                      onComplete(completionPath, selectedBackupId);
                    }
                    onDismiss();
                  }}
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
