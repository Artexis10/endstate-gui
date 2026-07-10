## Tasks

### Task 1: Capability probe
**File**: `src/lib/apply-capabilities.ts`
- [x] `engineSupportsApplyOnly(caps)` — true only when map-shaped `commands.apply.flags` includes `--only`; defaults FALSE when unknown (mirrors `engineSupportsIfChanged`)
- [x] Unit tests: null/missing caps, legacy string[] `commands`, flags without `--only`, flags with `--only`, absent apply entry

### Task 2: --only value builder
**File**: `src/lib/apply-utils.ts`
- [x] `buildOnlyFlagValue(ids)` — comma-join, trim, dedupe, drop blanks; null for empty result so the flag is always omitted rather than emitted blank
- [x] Unit tests: exact joined string, single id, undefined/null/empty, blank-only input, dedupe + order preservation

### Task 3: Setup-flow picker
**File**: `src/components/app/intent/setup-flow.tsx`
- [x] `PreviewResult.actions` (envelope actions: manifest `id` + winget `ref`) and `applyOnlySupported` prop (default false → dark)
- [x] `selectedAppIds` state initialized to all selectable ids on preview completion; reset on resetKey / back-to-profiles
- [x] Row checkboxes on installable rows only (Checkbox pattern from `ConfigModuleSelector`), PRESENT apps selectable, unchecked rows dimmed
- [x] "N of M selected" header + Select all / Select none affordances
- [x] Summary line and count chips re-sliced client-side from the checked set
- [x] Apply disabled at zero selected; strict subset → `onApply(profile, { …restoreOptions, onlyAppIds })` (selected winget ids + all manual ids, envelope order); all-selected omits the field

### Task 4: App wiring
**File**: `src/App.tsx`
- [x] Preview handler returns envelope `actions` alongside appEvents
- [x] Apply handler accepts `onlyAppIds` and appends `--only <buildOnlyFlagValue(...)>` when non-null
- [x] `applyOnlySupported` state set from `engineSupportsApplyOnly` at the capabilities handshake; prop passed to `SetupFlow`

### Task 5: Tests
**File**: `src/components/app/intent/setup-flow-app-picker.test.tsx`
- [x] Capability gating: dark without the flag (no checkboxes/header, onApply options unchanged); dark when actions missing
- [x] Defaults: all checked, "3 of 3 selected"
- [x] Select none → all unchecked + Apply disabled; select all → restored + all-selected omits `onlyAppIds`
- [x] Counts re-slice on uncheck
- [x] Exact subset id list passed to onApply; manual/config-only ids always included (and have no checkbox)
- [x] Composition with restore intent (`restoreIntent` + `selectedModules` + `onlyAppIds` together)
- [x] PRESENT app selectable and excludable

### Task 6: Verification
- [x] `npx tsc --noEmit` clean
- [x] `npm run test:unit` green
- [x] `npx eslint` clean on touched files
- [x] `npm run openspec:validate` green
