/**
 * ConfigModuleSelector - Per-module checkboxes for selecting which settings to restore
 */

import { Checkbox } from '@/components/ui/checkbox';
import type { ConfigModuleInfo } from '@/types';

interface ConfigModuleSelectorProps {
  modules: ConfigModuleInfo[];
  selectedModules: string[];
  onSelectionChange: (moduleIds: string[]) => void;
  disabled?: boolean;
}

export function ConfigModuleSelector({
  modules,
  selectedModules,
  onSelectionChange,
  disabled = false,
}: ConfigModuleSelectorProps) {
  if (modules.length === 0) return null;

  const handleToggle = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      onSelectionChange(selectedModules.filter((id) => id !== moduleId));
    } else {
      onSelectionChange([...selectedModules, moduleId]);
    }
  };

  return (
    <div
      className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
      data-testid="config-module-selector"
    >
      <p className="text-xs font-medium text-muted-foreground">
        Settings to restore:
      </p>

      <div className="space-y-2">
        {modules.map((mod) => {
          const isChecked = selectedModules.includes(mod.id);
          return (
            <div key={mod.id} className="flex items-center gap-2">
              <Checkbox
                id={`config-module-${mod.id}`}
                checked={isChecked}
                onCheckedChange={() => handleToggle(mod.id)}
                disabled={disabled}
              />
              <label
                htmlFor={`config-module-${mod.id}`}
                className="flex-1 flex items-center justify-between text-sm cursor-pointer"
              >
                <span>{mod.displayName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {mod.entries} file{mod.entries !== 1 ? 's' : ''}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
