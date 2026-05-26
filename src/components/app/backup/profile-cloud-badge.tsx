/**
 * "This profile has cloud backups" inline badge.
 *
 * Renders next to a profile name when the profile is present in the
 * cloudBackupIndex (a Map keyed by profile name). Distinct from
 * `HostedBackupChip` (which shows *account* state) — this one is about
 * the specific profile row in front of the user.
 *
 * Variants:
 *   - `compact` (default) — single Cloud icon + "Backed up" text. Used in
 *     dense lists (SelectedProfileCard dropdown items).
 *   - `detailed` — Cloud icon + "Backed up · N versions · {relative time}".
 *     Used where there's room for context (Manage Profiles modal table).
 */

import { Cloud } from 'lucide-react';
import type { BackupListItem } from '@/types';
import { formatRelativeTime } from '@/lib/lifecycle-state';
import { formatCount } from '@/lib/pluralize';

export interface ProfileCloudBadgeProps {
  cloudEntry: BackupListItem | undefined;
  variant?: 'compact' | 'detailed';
  /** Full testid for the badge root. Callers own the namespace so existing
   *  e2e/unit tests can keep their selectors stable across refactors. */
  testId?: string;
}

export function ProfileCloudBadge({
  cloudEntry,
  variant = 'compact',
  testId = 'profile-cloud-badge',
}: ProfileCloudBadgeProps) {
  if (!cloudEntry) return null;

  if (variant === 'detailed') {
    return (
      <span
        data-testid={testId}
        data-variant="detailed"
        className="inline-flex items-center gap-1 text-xs text-primary"
      >
        <Cloud className="h-3 w-3" aria-hidden="true" />
        <span>
          Backed up · {formatCount(cloudEntry.versionCount, 'version')} ·{' '}
          {formatRelativeTime(cloudEntry.updatedAt)}
        </span>
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      data-variant="compact"
      className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
    >
      <Cloud className="h-2.5 w-2.5" aria-hidden="true" />
      Backed up
    </span>
  );
}
