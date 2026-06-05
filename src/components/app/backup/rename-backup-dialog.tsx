/**
 * Rename a hosted backup — change its display label.
 *
 * Backups are identified by their backend id; the name is just a human label,
 * so this dialog only edits the label (and says so). Save is enabled only for a
 * non-empty, bounded, *changed* name. Mirrors the engine/backend cap (≤200).
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MAX_NAME_LEN = 200;

export interface RenameBackupDialogProps {
  open: boolean;
  /** The backup's current label, shown pre-filled. */
  currentName: string;
  /** Called with the trimmed new name when the user saves. */
  onConfirm: (newName: string) => void;
  onOpenChange: (open: boolean) => void;
  /** Disables inputs while the rename request is in flight. */
  busy?: boolean;
}

export function RenameBackupDialog({
  open,
  currentName,
  onConfirm,
  onOpenChange,
  busy = false,
}: RenameBackupDialogProps) {
  const [value, setValue] = useState(currentName);

  // Re-seed the field whenever the dialog (re)opens for a backup.
  useEffect(() => {
    if (open) setValue(currentName);
  }, [open, currentName]);

  const trimmed = value.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_NAME_LEN;
  const changed = trimmed !== currentName.trim();
  const canSave = valid && changed && !busy;

  const submit = () => {
    if (canSave) onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="rename-backup-dialog">
        <DialogHeader>
          <DialogTitle>Rename backup</DialogTitle>
          <DialogDescription>
            Give this backup a clearer name. This only changes the label — your
            backup and all its versions are unchanged.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Backup name"
          value={value}
          maxLength={MAX_NAME_LEN}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          data-testid="rename-backup-input"
          autoFocus
        />
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={submit}
            data-testid="rename-backup-save"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
