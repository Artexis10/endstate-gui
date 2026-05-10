/**
 * Per-backup version list.
 *
 * Shows version timestamps, encrypted size, and inline action buttons
 * (Restore this version / Delete this version). Inline buttons rather than a
 * dropdown menu because the shared `dropdown-menu.tsx` primitive is not yet
 * implemented in this repo and adding Radix DropdownMenu just for this is
 * out of scope for the hosted-backup PR.
 */

import { Button } from '@/components/ui/button';
import type { BackupVersionItem } from '@/types';
import { Download, Trash2 } from 'lucide-react';

export interface VersionListProps {
  versions: BackupVersionItem[];
  /** Whether write actions (delete) are allowed in the current subscription state. */
  canDelete: boolean;
  /** Whether read actions (restore) are allowed. */
  canRestore: boolean;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function VersionList({
  versions,
  canDelete,
  canRestore,
  onRestoreVersion,
  onDeleteVersion,
}: VersionListProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="version-list-empty">
        No versions yet.
      </p>
    );
  }
  return (
    <ul
      className="divide-y divide-border rounded-md border border-border"
      data-testid="version-list"
    >
      {versions.map((v) => (
        <li
          key={v.versionId}
          className="flex items-center justify-between p-3"
          data-testid={`version-row-${v.versionId}`}
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">{formatTimestamp(v.createdAt)}</span>
            <span className="text-xs text-muted-foreground">
              {formatBytes(v.size)} · {v.versionId.slice(0, 8)}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canRestore}
              onClick={() => onRestoreVersion(v.versionId)}
              data-testid={`version-restore-${v.versionId}`}
              aria-label={`Restore version ${v.versionId.slice(0, 8)}`}
            >
              <Download className="h-4 w-4" />
              Restore this version
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canDelete}
              onClick={() => onDeleteVersion(v.versionId)}
              data-testid={`version-delete-${v.versionId}`}
              aria-label={`Delete version ${v.versionId.slice(0, 8)}`}
              className="text-danger hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              Delete this version
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
