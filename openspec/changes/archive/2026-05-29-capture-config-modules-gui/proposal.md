## Why

The current config-to-app matching in the Capture Details modal uses a substring heuristic (`configMatchesApp()`) that matches kebab-case config IDs against Publisher.Product app IDs. This causes mismatches (e.g., "terminal" matching multiple apps) and orphaned configs that should be associated. The engine now provides an explicit `appId` field on each config module in the capture envelope, making the heuristic unnecessary.

## What Changes

- Add `CaptureConfigModule` type to represent engine-provided config module metadata with explicit `appId` association
- Extend `EndstateCaptureData` with optional `configModules` array
- Thread `configModules` through `ActionResult` and the capture handler in `App.tsx`
- Replace heuristic `configMatchesApp()` with engine-provided `appId` matching in `buildConfigMap()`
- Keep legacy heuristic as fallback for backward compatibility with older engine versions

## Capabilities

### New Capabilities

_(none — this enhances an existing capability)_

### Modified Capabilities

- `capture-config-visibility`: Config-to-app matching now uses engine-provided `configModules[].appId` instead of substring heuristic, with fallback to legacy matching

## Impact

- `src/types.ts` — New `CaptureConfigModule` interface, extended `EndstateCaptureData`
- `src/components/app/overview/types.ts` — Extended `ActionResult` with `configModules`
- `src/lib/capture-continuity.ts` — Extended `CaptureConfigData` and `buildCaptureActionResult` to thread `configModules`
- `src/App.tsx` — Pass `configModules` through capture handler
- `src/components/app/overview/components/action-details-modal.tsx` — New `buildConfigMap()` using `configModules`, legacy fallback
- Depends on engine change "capture-config-envelope" which adds `configModules` to the capture `--json` envelope
