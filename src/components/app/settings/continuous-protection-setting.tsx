/**
 * Settings control for Continuous Protection (scheduled daily drift check).
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

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

export interface ContinuousProtectionSettingProps {
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
  onToggle: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
  onAutoPushToggle: (enabled: boolean) => void;
}

export function ContinuousProtectionSetting({
  enabled,
  time,
  autoPush,
  autoPushAvailable,
  manifestAvailable,
  busy = false,
  onToggle,
  onTimeChange,
  onAutoPushToggle,
}: ContinuousProtectionSettingProps) {
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
              Upload the saved setup to Endstate Cloud
            </span>
            <span className="text-xs text-muted-foreground">
              Each daily check also sends the setup you last saved to Endstate
              Cloud. It uploads that saved snapshot again rather than capturing
              the drift it found, so save this computer again to record those
              changes. Unchanged setups are never re-uploaded.
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
    </div>
  );
}
