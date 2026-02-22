## Why

The engine already captures config modules (app settings) into zip bundles and returns structured config data in the capture envelope (`configsIncluded`, `configsSkipped`, `configsCaptureErrors`). The GUI currently ignores this data entirely — users see "67 apps captured" but have no visibility into which app settings were bundled. Phase 1 adds read-only config visibility so users understand what their capture contains.

## What Changes

- Extend `EndstateCaptureData` type with `outputFormat`, `configsIncluded`, `configsSkipped`, `configsCaptureErrors` fields
- Extend `ActionResult.counts` with `configsCaptured`, `configsSkipped`, `configsErrored` fields
- Update capture summary text to include config count when bundle has configs (e.g., "67 apps captured · 12 configs included")
- Add config module section to Capture Details modal showing captured/skipped/errored configs
- Handle edge cases: jsonc format (no config section), zip with no configs ("No app settings captured")

## Capabilities

### New Capabilities
- `capture-config-visibility`: Read-only display of config module capture results in the GUI capture flow

### Modified Capabilities
- `engine-capture-contract`: Add config-related fields to the GUI-side capture envelope contract (`outputFormat`, `configsIncluded`, `configsSkipped`, `configsCaptureErrors`)

## Impact

- **Types**: `src/types.ts` (EndstateCaptureData), `src/components/app/overview/types.ts` (ActionResult.counts)
- **Logic**: `src/lib/capture-continuity.ts` (summary text, action result builder, new config helpers)
- **Handler**: `src/App.tsx` (capture completion handler reads new fields)
- **UI**: New `CaptureConfigSummary` component for capture details modal
- **Spec**: `openspec/specs/engine-capture-contract.md` updated with config field contract
- **No engine changes**: Engine already produces these fields
- **No breaking changes**: All new fields are optional
