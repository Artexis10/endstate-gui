/**
 * Pre-push quota guard, shared by every MANUAL push surface (the Backup pane
 * and the "Back up to cloud" profile-card action). NOT used by the silent
 * auto-backup-after-capture — that stays un-gated by design.
 *
 * `guardPush(args, run)` asks the engine for an accurate pre-push size estimate
 * (`backup estimate`), compares it to the user's remaining quota, and:
 *   - if the push lands usage in the top 10% of quota (or over) → opens a soft
 *     confirm dialog; `run()` fires only if the user continues;
 *   - otherwise → calls `run()` immediately.
 *
 * Graceful degradation: if the estimate fails for any reason (older engine
 * without the command, network/keychain hiccup), we never block the backup —
 * `run()` is called as before. "When in doubt, back up."
 */

import { useCallback, useState } from 'react';
import type { AppSettings } from '@/settings';
import type { BackupEstimateData, BackupStatusData } from '@/types';
import { backupEstimate } from '@/lib/backup-bridge';
import { assessPrePushQuota, type PrePushQuotaAssessment } from '@/lib/pre-push-quota';
import { PrePushSizeDialog } from './pre-push-size-dialog';

interface Pending {
  estimate: BackupEstimateData;
  assessment: PrePushQuotaAssessment;
  run: () => void;
}

export function usePrePushGuard(
  settings: AppSettings,
  status: BackupStatusData | null | undefined,
) {
  const [pending, setPending] = useState<Pending | null>(null);

  const guardPush = useCallback(
    async (
      args: { profile: string; backupId?: string },
      run: () => void | Promise<void>,
    ): Promise<void> => {
      let estimate: BackupEstimateData;
      try {
        estimate = await backupEstimate(settings, {
          profile: args.profile,
          backupId: args.backupId,
        });
      } catch {
        // Estimate unavailable (older engine, transient error) → never block a
        // backup. Push as before.
        await run();
        return;
      }

      const assessment = assessPrePushQuota(
        estimate.estimatedUploadBytes,
        status?.quotaUsedBytes,
        status?.quotaTotalBytes,
      );

      if (assessment.level === 'warn') {
        setPending({ estimate, assessment, run: () => void run() });
      } else {
        await run();
      }
    },
    [settings, status],
  );

  const dialog = (
    <PrePushSizeDialog
      open={pending !== null}
      onOpenChange={(o) => {
        if (!o) setPending(null);
      }}
      estimatedUploadBytes={pending?.estimate.estimatedUploadBytes ?? 0}
      remainingBytes={pending?.assessment.remainingBytes}
      quotaTotalBytes={status?.quotaTotalBytes}
      pushesLeft={pending?.assessment.pushesLeft}
      exceeds={pending?.assessment.exceeds ?? false}
      onConfirm={() => {
        const p = pending;
        setPending(null);
        p?.run();
      }}
    />
  );

  return { guardPush, dialog };
}
