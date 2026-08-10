/**
 * Settings control for scheduled daily setup checks.
 *
 * Bound to `settings.scheduleEnabled` / `scheduleTime` / `scheduleAutoPush`.
 * The main toggle IS the consent — no extra dialog; the caller invokes
 * `schedule enable` / `schedule disable` on change. Enabling requires a saved
 * capture to verify against (`manifestAvailable`); until one exists the toggle
 * is disabled with a "Save this computer first" hint.
 *
 * The auto-push sub-toggle is only offered when the caller determines both the
 * engine capability (`features.schedule.autoPush`) and the auto-backup runtime
 * conditions hold (`autoPushAvailable`). Rendered only when the engine
 * advertises `features.schedule.supported` (the caller gates visibility).
 */

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ContinuousProtectionSettingProps {
  /** Managed wording is only valid for engine-identified Endstate Cloud. */
  providerKind?: 'endstate-cloud' | 'self-hosted' | 'unknown';
  /** Whether the scheduled drift check is enabled (user preference). */
  enabled: boolean;
  /** Time-of-day (HH:MM, 24h) the daily check runs. */
  time: string;
  /** Whether auto-backup-on-drift is enabled (user preference). */
  autoPush: boolean;
  /** Whether the auto-push sub-toggle should be offered at all. */
  autoPushAvailable: boolean;
  /** Whether a saved capture exists to verify against. */
  manifestAvailable: boolean;
  /** Disables controls while an enable/disable call is in flight. */
  busy?: boolean;
  /** Present only for a legacy ambiguous queued upload. */
  uploadUncertainArtifactSha256?: string;
  onDiscardAmbiguousUpload?: () => void;
  onToggle: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
  onAutoPushToggle: (enabled: boolean) => void;
}

export function ContinuousProtectionSetting({
  providerKind = 'endstate-cloud',
  enabled,
  time,
  autoPush,
  autoPushAvailable,
  manifestAvailable,
  busy = false,
  uploadUncertainArtifactSha256,
  onDiscardAmbiguousUpload,
  onToggle,
  onTimeChange,
  onAutoPushToggle,
}: ContinuousProtectionSettingProps) {
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  // Turning OFF is always allowed; turning ON requires a saved capture.
  const switchDisabled = busy || (!enabled && !manifestAvailable);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col pr-4">
          <span id="continuous-protection-label" className="text-sm font-medium">
            Check this computer for drift daily
          </span>
          <span className="text-xs text-muted-foreground">
            Endstate compares this computer against your last saved snapshot
            every day and flags anything that changed.
          </span>
          {!manifestAvailable && (
            <span
              className="text-xs text-muted-foreground mt-1"
              data-testid="continuous-protection-hint"
            >
              Save this computer first
            </span>
          )}
        </div>
        <Switch
          checked={enabled}
          disabled={switchDisabled}
          onCheckedChange={onToggle}
          aria-labelledby="continuous-protection-label"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="continuous-protection-time" className="text-sm text-muted-foreground">
          Check at
        </label>
        <Input
          id="continuous-protection-time"
          type="time"
          className="w-32"
          value={time}
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) onTimeChange(e.target.value);
          }}
        />
      </div>

      {autoPushAvailable && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col pr-4">
            <span id="continuous-protection-autopush-label" className="text-sm font-medium">
              {providerKind === 'self-hosted'
                ? 'Upload the saved setup to your configured backup service'
                : providerKind === 'endstate-cloud' ? 'Upload the saved setup to Endstate Cloud' : 'Upload the saved setup to your backup service'}
            </span>
            <span className="text-xs text-muted-foreground">
              Each daily check captures a fresh local version when changes are
              found, then uploads it to {providerKind === 'self-hosted' ? 'your configured backup service' : providerKind === 'endstate-cloud' ? 'Endstate Cloud' : 'your backup service'}. Unchanged setups are
              never re-uploaded.
            </span>
          </div>
          <Switch
            checked={autoPush}
            disabled={busy}
            onCheckedChange={onAutoPushToggle}
            aria-labelledby="continuous-protection-autopush-label"
          />
        </div>
      )}

      {uploadUncertainArtifactSha256 && onDiscardAmbiguousUpload && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          <p className="font-medium">An upload may already have been accepted</p>
          <p className="mt-1 text-muted-foreground">
            Check {providerKind === 'endstate-cloud' ? 'Endstate Cloud' : 'your backup service'}, or save a replacement version manually. Automatic retry is paused to avoid duplicates.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={() => setDiscardConfirmOpen(true)}
          >
            Discard ambiguous upload
          </Button>
        </div>
      )}

      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard ambiguous upload?</DialogTitle>
            <DialogDescription>
              This removes only the queued upload. Your local capture and scheduled baseline are kept. Check the backup service first if the version may already be there.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDiscardConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                onDiscardAmbiguousUpload?.();
                setDiscardConfirmOpen(false);
              }}
            >
              Discard upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
