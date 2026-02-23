/**
 * RestoreIntentToggle - Controls whether to restore settings alongside app installation
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield } from 'lucide-react';
import type { RestoreIntent } from '@/types';

interface RestoreIntentToggleProps {
  restoreIntent: RestoreIntent;
  onRestoreIntentChange: (intent: RestoreIntent) => void;
  configModuleCount: number;
  disabled?: boolean;
}

export function RestoreIntentToggle({
  restoreIntent,
  onRestoreIntentChange,
  configModuleCount,
  disabled = false,
}: RestoreIntentToggleProps) {
  if (configModuleCount <= 0) return null;

  return (
    <div
      className="rounded-lg border border-border bg-muted/30 p-4 space-y-3"
      data-testid="restore-intent-toggle"
    >
      <p className="text-sm text-muted-foreground">
        This profile includes settings for {configModuleCount} app{configModuleCount !== 1 ? 's' : ''}
      </p>

      <RadioGroup
        value={restoreIntent}
        onValueChange={(value) => onRestoreIntentChange(value as RestoreIntent)}
        disabled={disabled}
        className="gap-3"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="apps-only" id="restore-apps-only" />
          <label htmlFor="restore-apps-only" className="text-sm cursor-pointer">
            Install apps only
          </label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="apps-and-settings" id="restore-apps-and-settings" />
          <label htmlFor="restore-apps-and-settings" className="text-sm cursor-pointer">
            Install apps and restore settings
          </label>
        </div>
      </RadioGroup>

      {restoreIntent === 'apps-and-settings' && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3 w-3 flex-shrink-0" />
          Settings are backed up first. You can revert at any time.
        </p>
      )}
    </div>
  );
}
