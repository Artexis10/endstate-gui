/**
 * One-time auto-backup consent prompt.
 *
 * Shown once, the first time an eligible capture would trigger an automatic
 * backup (when `autoBackupPromptSeen` is false). Non-blocking; the toggle is
 * pre-set ON (low-friction default) but the user can turn it off. The decision
 * fires exactly once per open — via the confirm button or any dismiss — and the
 * caller persists it to `autoBackupEnabled` + sets `autoBackupPromptSeen`.
 */

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export interface AutoBackupConsentProps {
  open: boolean;
  /** Fired once with the user's choice (the toggle state) on confirm or dismiss. */
  onDecision: (enabled: boolean) => void;
}

export function AutoBackupConsent({ open, onDecision }: AutoBackupConsentProps) {
  const [enabled, setEnabled] = useState(true);
  const decidedRef = useRef(false);

  // Reset toggle + guard each time the prompt (re)opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      decidedRef.current = false;
      setEnabled(true);
    }
  }

  const decide = (value: boolean) => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    onDecision(value);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) decide(enabled);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keep your setup backed up automatically?</DialogTitle>
          <DialogDescription>
            When this is on, Endstate quietly backs up your setup to your cloud
            after each capture — no extra steps, and it never re-uploads an
            unchanged setup. You can change this anytime in Settings.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
          <span className="text-sm font-medium">
            Back up automatically after each capture
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Back up automatically after each capture"
          />
        </label>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={() => decide(enabled)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
