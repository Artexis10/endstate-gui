/**
 * Account deletion confirmation modal.
 *
 * Per Hosted Backup contract §12: explicit warning + email-match
 * confirmation before invoking `endstate account delete --confirm`. The
 * engine command takes no email argument; the email match happens entirely
 * GUI-side as a friction gate against accidental clicks.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export interface AccountDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The signed-in user's email — typed value must match exactly to enable. */
  expectedEmail: string;
  /** Resolves once `accountDelete()` returns. */
  onConfirm: () => Promise<void>;
}

export function AccountDeleteModal({
  open,
  onOpenChange,
  expectedEmail,
  onConfirm,
}: AccountDeleteModalProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === expectedEmail.trim() && expectedEmail.length > 0;

  const handleConfirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setTyped('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) setTyped('');
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This deletes your account, your subscription, and all backed-up data. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm">
            Type your email <code className="font-mono">{expectedEmail}</code> to confirm.
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={expectedEmail}
            autoComplete="off"
            data-testid="account-delete-email-input"
          />
        </label>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={!matches || busy}
            data-testid="account-delete-confirm"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting
              </>
            ) : (
              'Delete account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
