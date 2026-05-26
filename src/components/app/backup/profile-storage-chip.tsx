/**
 * "Where does this profile live" indicator.
 *
 * Renders one of two glanceable chips so a profile row reads as cloud-backed
 * or local-only at a glance, without the user squinting at a metadata
 * subtitle. The two states are deliberately symmetric — both branches always
 * render something so neighbouring rows line up visually and "no chip at all"
 * never reads as a third category.
 *
 *   - `cloudEntry` set      → tinted "☁ Cloud" pill (primary tint)
 *   - `cloudEntry` undefined → muted "Local only" pill (subtler tone so it
 *     reads as a calm fact rather than a warning).
 *
 * Detailed metadata ("3 versions · updated 1h ago") still belongs in
 * `ProfileCloudBadge`'s detailed variant — that component answers *how much*
 * is in the cloud; this one answers *where the profile lives*. Both can
 * appear on the same row for cloud-backed profiles.
 */

import { Cloud, HardDrive } from 'lucide-react';
import type { BackupListItem } from '@/types';

export interface ProfileStorageChipProps {
  /** When set, renders the Cloud variant. Undefined → Local-only variant. */
  cloudEntry: BackupListItem | undefined;
  /** Full testid for the chip root. Callers own the namespace. */
  testId?: string;
}

export function ProfileStorageChip({
  cloudEntry,
  testId,
}: ProfileStorageChipProps) {
  if (cloudEntry) {
    return (
      <span
        data-testid={testId ?? 'profile-storage-chip'}
        data-state="cloud"
        className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
      >
        <Cloud className="h-2.5 w-2.5" aria-hidden="true" />
        Cloud
      </span>
    );
  }
  return (
    <span
      data-testid={testId ?? 'profile-storage-chip'}
      data-state="local"
      className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      <HardDrive className="h-2.5 w-2.5" aria-hidden="true" />
      Local only
    </span>
  );
}
