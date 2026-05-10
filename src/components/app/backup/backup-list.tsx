/**
 * List of the user's backups, with per-backup push / restore / delete actions.
 *
 * In v1 there is typically a single backup per account (the user's machine
 * profile). Rendered as a loop anyway so future multi-backup support is a
 * non-event.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BackupListItem } from '@/types';
import { HardDrive, Trash2, Upload, Download } from 'lucide-react';

export interface BackupListProps {
  backups: BackupListItem[];
  /** Whether write actions (push) are allowed in the current subscription state. */
  canWrite: boolean;
  /** Whether read actions (restore) are allowed. */
  canRestore: boolean;
  /** Whether delete is allowed (per contract §10, allowed in any non-`none` state). */
  canDelete: boolean;
  onPush: (backupId: string) => void;
  onRestore: (backupId: string) => void;
  onDelete: (backupId: string) => void;
  onSelect: (backupId: string) => void;
  selectedBackupId: string | null;
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

export function BackupList({
  backups,
  canWrite,
  canRestore,
  canDelete,
  onPush,
  onRestore,
  onDelete,
  onSelect,
  selectedBackupId,
}: BackupListProps) {
  if (backups.length === 0) {
    return (
      <Card data-testid="backup-list-empty">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <HardDrive className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No backups yet. Push a profile to create the first version.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="backup-list">
      {backups.map((b) => {
        const selected = selectedBackupId === b.id;
        return (
          <Card
            key={b.id}
            data-testid={`backup-row-${b.id}`}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onSelect(b.id)}
            className={
              selected
                ? 'border-primary cursor-pointer'
                : 'cursor-pointer hover:border-border-strong'
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-base">{b.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {b.versionCount} version{b.versionCount === 1 ? '' : 's'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <p>{formatBytes(b.totalSize)} total</p>
                <p>Last updated {formatTimestamp(b.updatedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!canWrite}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPush(b.id);
                  }}
                  data-testid={`backup-push-${b.id}`}
                >
                  <Upload className="h-4 w-4" />
                  Push new version
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canRestore || !b.latestVersionId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(b.id);
                  }}
                  data-testid={`backup-restore-${b.id}`}
                >
                  <Download className="h-4 w-4" />
                  Restore
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canDelete}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(b.id);
                  }}
                  data-testid={`backup-delete-${b.id}`}
                  className="text-danger hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete backup
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
