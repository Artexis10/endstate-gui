/**
 * ConfigModuleSelector - Per-module checkboxes for selecting which settings to restore
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
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

  const allSelected = modules.every((m) => selectedModules.includes(m.id));

  const handleToggle = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      onSelectionChange(selectedModules.filter((id) => id !== moduleId));
    } else {
      onSelectionChange([...selectedModules, moduleId]);
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(modules.map((m) => m.id));
    }
  };

  return (
    <div
      className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
      data-testid="config-module-selector"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Settings to restore:
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-0.5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={handleToggleAll}
          disabled={disabled}
          data-testid="config-module-toggle-all"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
      </div>

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
                {mod.entries > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {mod.entries} file{mod.entries !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
