## 1. Setup-flow: Add module selection state and rendering

- [x] 1.1 Add `selectedModules` state (default `[]`) in setup-flow.tsx
- [x] 1.2 Reset selectedModules on flow reset and back-to-profiles
- [x] 1.3 Build ConfigModuleInfo[] from previewResult.configModuleMap
- [x] 1.4 Render ConfigModuleSelector beneath RestoreIntentToggle when restoreIntent is "apps-and-settings" and modules exist

## 2. Pass selectedModules through onApply

- [x] 2.1 Extend onApply prop type to include selectedModules
- [x] 2.2 Pass selectedModules from handleApply to onApply callback

## 3. App.tsx: Construct --restore-filter

- [x] 3.1 In the apply handler, when selectedModules is non-empty, add --enable-restore and --restore-filter to CLI args
- [x] 3.2 When selectedModules is empty, omit --enable-restore

## 4. Tests

- [x] 4.1 ConfigModuleSelector renders in setup-flow with correct modules
- [x] 4.2 All modules default unchecked
- [x] 4.3 Non-empty selection produces --restore-filter arg (via onApply callback)
- [x] 4.4 Empty selection omits --enable-restore (via onApply callback)

## 5. Verification

- [x] 5.1 `npm run test` passes
- [x] 5.2 `npm run openspec:validate` passes
- [x] 5.3 `npm run build` succeeds
