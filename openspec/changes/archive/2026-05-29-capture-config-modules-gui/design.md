## Approach

Use the engine-provided `configModules` array (with explicit `appId` per module) as the primary config-to-app association mechanism, falling back to the legacy substring heuristic when the field is absent (backward compatibility with older engines).

## Data Flow

```
Engine capture --json envelope
  → configModules: [{ id, appId, displayName, status, filesCaptured }]
  → EndstateCaptureData.configModules (src/types.ts)
  → CaptureConfigData.configModules (capture-continuity.ts)
  → buildCaptureActionResult() → ActionResult.configModules
  → ActionDetailsModal → buildConfigMap(actionResult, appIds)
    → if configModules present: match by appId segments
    → else: legacy configMatchesApp heuristic
```

## Key Decisions

1. **Backward compatibility**: Keep old `configsIncluded`/`configsSkipped`/`configsCaptureErrors` fields and the legacy heuristic as fallback. Do not remove them.
2. **appId matching strategy**: The engine's `appId` is a kebab-case module directory name (e.g., "vscode"). App IDs in events are winget Publisher.Product IDs (e.g., "Microsoft.VisualStudioCode"). Match by checking if any dot-separated segment of the app ID contains or equals the module `appId`. This is more reliable than the old heuristic since `appId` is authoritative.
3. **Skip filtering**: Skipped modules (`status: 'skipped'`) are filtered out — they represent "no files found" which is noise.
4. **Display names**: Unmatched modules from the new path use `displayName` (human-readable) instead of raw module IDs.

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `CaptureConfigModule` interface, add `configModules?` to `EndstateCaptureData` |
| `src/components/app/overview/types.ts` | Add `configModules?` to `ActionResult` |
| `src/lib/capture-continuity.ts` | Add `configModules?` to `CaptureConfigData`, thread through `buildCaptureActionResult` |
| `src/App.tsx` | Pass `configModules` from envelope data to `buildCaptureActionResult` |
| `src/components/app/overview/components/action-details-modal.tsx` | Rewrite `buildConfigMap()`, rename old heuristic to `configMatchesAppLegacy` |
| New: `src/components/app/overview/components/action-details-modal.test.tsx` | Tests for new and legacy matching paths |
