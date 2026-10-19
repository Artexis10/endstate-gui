/**
 * ConfigModuleSelector - Per-module checkboxes for selecting which settings to restore
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { ConfigModuleInfo } from '@/types';

interface ConfigModuleSelectorProps {
  modules: ConfigModuleInfo[];
  /** The whole selection, which may include modules another selector shows. */
  selectedModules: string[];
  onSelectionChange: (moduleIds: string[]) => void;
  disabled?: boolean;
  title?: string;
  /** Muted line under the title. */
  description?: string;
  /** What one of a module's entries is, for its count. */
  entryNoun?: { singular: string; plural: string };
  testId?: string;
}

export function ConfigModuleSelector({
  modules,
  selectedModules,
  onSelectionChange,
  disabled = false,
  title = 'Settings to restore:',
  description,
  entryNoun = { singular: 'file', plural: 'files' },
  testId = 'config-module-selector',
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

  // Select all and Deselect all change only this selector's modules, so a
  // selection made in another selector stays as the user left it.
  const handleToggleAll = () => {
    const ownIds = new Set(modules.map((m) => m.id));
    const others = selectedModules.filter((id) => !ownIds.has(id));
    onSelectionChange(allSelected ? others : [...others, ...ownIds]);
  };

  return (
    <div
      className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {title}
          </p>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
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
                    {mod.entries} {mod.entries === 1 ? entryNoun.singular : entryNoun.plural}
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
