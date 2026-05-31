/**
 * Reversible Settings control for automatic hosted backup.
 *
 * Bound to `settings.autoBackupEnabled`. Turning it off stops all automatic
 * pushes; turning it back on re-enables them without re-showing the one-time
 * consent prompt (the prompt is gated on `autoBackupPromptSeen`, not this).
 * Rendered only when hosted backup is supported (the caller gates visibility).
 */

import { Switch } from '@/components/ui/switch';

export interface AutoBackupSettingProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function AutoBackupSetting({ enabled, onChange }: AutoBackupSettingProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col pr-4">
        <span id="auto-backup-setting-label" className="text-sm font-medium">
          Automatic cloud backup
        </span>
        <span className="text-xs text-muted-foreground">
          Back up your setup to your cloud after each capture. Unchanged setups
          are never re-uploaded.
        </span>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        aria-labelledby="auto-backup-setting-label"
      />
    </div>
  );
}
