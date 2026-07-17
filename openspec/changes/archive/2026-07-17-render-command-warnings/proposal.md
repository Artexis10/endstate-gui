## Why

Endstate 2.24 adds ordered command warnings, including cross-driver package ambiguity warnings, to command data in final envelopes. The GUI currently drops those warnings from its existing setup result surfaces, leaving users unaware of potentially overlapping Chocolatey and winget ownership even though the engine has deliberately preserved both declarations.

## What Changes

- Add a shared command-warning presentation that renders engine-authored warning messages verbatim and in engine order.
- Surface warnings from setup preview (`apply --dry-run`) and live apply envelopes that reach the existing success/partial-result surfaces, without changing command success, item statuses, actions, or summary counts.
- Replace preview warnings with the live apply envelope's warnings when apply completes; never merge, correlate, filter, or deduplicate warning lists.
- Extend apply, preview, and verify result types with optional warning data for engine-contract compatibility. Visible verify warnings remain out of scope until the GUI has a standalone verify result surface.
- Keep capture warnings on their existing capture-specific code-to-copy path; this change does not reinterpret or consolidate them.

## Capabilities

### New Capabilities

- `command-warning-presentation`: Presentation rules for final-envelope command warnings in result surfaces.

### Modified Capabilities

- `final-state-from-envelope`: Command warnings are authoritative only from the final envelope and are replaced by the subsequent completed command result.
- `gui-thin-layer`: The GUI displays warning data without adding package-manager inference, matching, deduplication, rerouting, or outcome mutation.

## Impact

- Frontend envelope/result types in `src/types.ts` and setup-flow result plumbing.
- Setup preview and apply orchestration in `src/App.tsx`; hard-error surfaces remain unchanged.
- Setup result presentation in `src/components/app/intent/setup-flow.tsx` plus a focused warning-list component.
- Unit and orchestration tests for verbatim ordering, duplicates, phase replacement, reset behavior, and unchanged success/count semantics.
- No CLI arguments, provisioning logic, dependencies, capture-warning behavior, or engine schema version changes.
