# Proposal: Wire per-module restore selection to --restore-filter

## Problem
Apply with "restore settings" restores ALL config modules unconditionally, overwriting user settings. The engine supports --restore-filter and the GUI has ConfigModuleSelector, but they aren't connected.

## What Changes
- Render existing ConfigModuleSelector in setup-flow preview-done phase when restore intent is "apps and settings"
- Pass selectedModules through onApply callback to engine command
- Construct --restore-filter CLI argument from selected modules
- Default all modules to unchecked (restore OFF by default)

## Capabilities

### New Capabilities
- `restore-module-approval`: Per-module selection in setup flow wired to engine --restore-filter

## Impact
- Modified: src/components/app/intent/setup-flow.tsx (render ConfigModuleSelector, pass selectedModules)
- Modified: App.tsx (construct --restore-filter in engine command)
- No new components (ConfigModuleSelector already exists)
- No engine changes (engine already supports --restore-filter)
