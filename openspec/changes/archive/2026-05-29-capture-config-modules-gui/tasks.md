## Tasks

### Task 1: Add CaptureConfigModule type and extend EndstateCaptureData
**File**: `src/types.ts`
- Add `CaptureConfigModule` interface with fields: `id`, `appId`, `displayName`, `status`, `filesCaptured`
- Add optional `configModules?: CaptureConfigModule[]` to `EndstateCaptureData`
- Do NOT remove existing `configsIncluded`/`configsSkipped`/`configsCaptureErrors`

### Task 2: Thread configModules through ActionResult
**File**: `src/components/app/overview/types.ts`
- Add `configModules?: CaptureConfigModule[]` to `ActionResult`
- Import `CaptureConfigModule` from `@/types`

### Task 3: Populate configModules in capture handler
**Files**: `src/lib/capture-continuity.ts`, `src/App.tsx`
- Add `configModules?` to `CaptureConfigData` interface
- Thread through `buildCaptureActionResult` return type and body
- In `App.tsx`, pass `configModules: result.envelopeData?.configModules` to the config data

### Task 4: Replace heuristic matching in action-details-modal.tsx
**File**: `src/components/app/overview/components/action-details-modal.tsx`
- Rename `configMatchesApp` → `configMatchesAppLegacy`
- Rewrite `buildConfigMap()` to accept `actionResult` + `appIds`
- New path: iterate `configModules`, match by `appId` segments, filter skipped
- Legacy path: use `configsIncluded`/`configsCaptureErrors` with `configMatchesAppLegacy`
- Update call site to pass `actionResult` instead of separate arrays
- Use `displayName` for unmatched modules

### Task 5: Add tests
**File**: `src/components/app/overview/components/action-details-modal.test.tsx`
- configModules path: correct appId matching
- Skipped modules filtered out
- Fallback to legacy when configModules absent
- Unmatched modules show displayName
