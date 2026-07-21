## Why

The engine emits one `configResolutions[]` row per captured config set. A single legacy application bundle can yield ten or more rows that share the same engine-authored `label` and `message` (for example ten `legacy_unverified` "Compatibility unknown" sets). The current GUI renders one bordered card per row, so setup previews fill with a wall of near-identical cards. The repetition buries the decision-bearing rows (side-by-side target ambiguity) and adds noise to plain confirmations. Presentation must collapse redundant repetition without merging distinct engine copy or hiding any engine-authored warning.

## What Changes

- Group configuration resolutions by the composite `(resolution, label, message)` key and render one card per group, showing the engine `label`, a GUI-authored count line, the member module display names, the engine `message` once, and each distinct engine `remediation` once. Distinct engine messages within one resolution kind stay in separate cards.
- Keep every row whose `reason` is `ambiguous_target_instance` as an individual decision card, never grouped, because each carries its own target-instance selector.
- Render the `direct` ("Compatible") resolution as a single quiet muted line with no card chrome and no status tag, because confirmations do not warrant attention weight.
- Move per-member technical provenance into one "Configuration details" disclosure per group card, preserving each member's `config-resolution-<captureId>` test hook and adding a `config-resolution-group-<resolution>` hook on the group card.
- Keep the engine-authored `legacy_unverified` warning (label, message, remediation) at the top level of its group card, visible before execution without opening any disclosure.
- Gate the completed-apply configuration list behind the same `restoreIntent === 'apps-and-settings'` guard the preview path already uses, so an install-only apply never shows configuration cards.

## Capabilities

### Modified Capabilities

- `config-generation-presentation`: Render engine-owned configuration resolutions as grouped presentation while preserving verbatim engine copy, the ambiguous-target decision cards, progressive provenance, and config-free behavior.

## Impact

- Presentation-only change in `src/components/app/intent/config-resolution-list.tsx` and the completed-apply gate in `src/components/app/intent/setup-flow.tsx`.
- No changes to shared types, engine copy, CLI argument construction, capability gating, or the `restore-module-approval` consent lane.
- Component, setup-flow, and browser tests updated for grouped presentation; the pre-execution `legacy_unverified` warning stays visible without a disclosure.
