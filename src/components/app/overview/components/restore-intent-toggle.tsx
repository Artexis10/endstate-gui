/**
 * RestoreIntentToggle - Controls whether to restore settings alongside app installation
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield } from 'lucide-react';
import type { RestoreIntent } from '@/types';
import { NON_APP_SETTINGS_KINDS, countSettingsPhrase, type SettingsKind } from '@/lib/settings-kind';

interface RestoreIntentToggleProps {
  restoreIntent: RestoreIntent;
  onRestoreIntentChange: (intent: RestoreIntent) => void;
  /** Every settings module the profile offers, of any kind. */
  configModuleCount: number;
  /** How many of those modules belong to no app, by kind. */
  nonAppSettingsCounts?: Partial<Record<Exclude<SettingsKind, 'app'>, number>>;
  disabled?: boolean;
}

export function RestoreIntentToggle({
  restoreIntent,
  onRestoreIntentChange,
  configModuleCount,
  nonAppSettingsCounts = {},
  disabled = false,
}: RestoreIntentToggleProps) {
  if (configModuleCount <= 0) return null;

  const nonAppKinds = NON_APP_SETTINGS_KINDS.filter((kind) => (nonAppSettingsCounts[kind] ?? 0) > 0);
  const appSettingsCount = configModuleCount
    - nonAppKinds.reduce((sum, kind) => sum + (nonAppSettingsCounts[kind] ?? 0), 0);
  const parts = [
    ...(appSettingsCount > 0 ? [`settings for ${appSettingsCount} app${appSettingsCount !== 1 ? 's' : ''}`] : []),
    ...nonAppKinds.map((kind) => countSettingsPhrase(kind, nonAppSettingsCounts[kind] ?? 0)),
  ];

  return (
    <div
      className="rounded-lg border border-border bg-muted/30 p-4 space-y-3"
      data-testid="restore-intent-toggle"
    >
      <p className="text-sm text-muted-foreground">
        This profile includes {parts.join(' and ')}
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
