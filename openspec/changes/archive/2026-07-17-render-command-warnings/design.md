## Context

Engine 2.24 adds optional `data.warnings` to capture, plan, apply, and verify final envelopes. The setup flow already consumes the final `apply --dry-run` and live `apply` envelopes, but its result models retain only actions, summaries, and item events, so runtime warnings disappear before presentation. Capture warnings share the base warning shape but already have a command-specific UI that maps codes to capture copy; reusing that path would incorrectly reinterpret general command warnings.

The GUI's thin-layer contract makes the engine authoritative for warning detection and wording. In particular, the GUI must not try to decide whether Chocolatey and winget entries identify the same product.

## Goals / Non-Goals

**Goals:**

- Preserve optional command warnings through the frontend result pipeline.
- Present preview and live-apply warnings as ordered, non-blocking advisories on the existing success/partial-result surfaces.
- Keep duplicate warning objects visible and engine messages unchanged.
- Ensure selection changes, status labels, actions, and summary counts remain independent of warnings.
- Declare verify warnings in the shared compile-time contract types for compatibility with the newer engine schema.

**Non-Goals:**

- A new standalone verify-results experience. The current application has no visible verify result surface to attach one to.
- Standalone `plan` presentation. The setup preview invokes `apply --dry-run`; it does not invoke `plan`.
- Warning presentation on hard-error surfaces. Current orchestration throws before constructing a setup result when the final envelope is a hard error.
- Any package identity inference, fuzzy matching, correlation, deduplication, fallback, or driver routing in the GUI.
- Consolidating or changing capture-specific warning presentation.
- Changing engine invocation, streaming events, command success semantics, or provisioning behavior.

## Decisions

### Use one shared structural warning type and a presentation-only component

`CommandWarning` carries `code`, `message`, and optional `driver` and `ref`. Apply, preview, and verify result data accept an optional ordered array. A focused `CommandWarningList` renders the engine message and exact driver/ref context when present. It exposes a named semantic region containing a list, but no assertive alert role. It does not dispatch on `code`; unknown warning codes therefore remain useful automatically.

React escapes message text, so preserving engine wording does not require injecting HTML. Identical entries use their array position as part of the render key because duplicate warning objects are meaningful and must not collapse.

Alternative considered: reuse capture-warning code mapping. Rejected because its existing humanized, command-specific mappings would violate verbatim runtime-warning presentation.

### Treat warnings as phase-local final-envelope state

Preview warnings come only from the completed dry-run envelope and stay attached to that preview while the user changes the subset. The GUI does not filter them when checkboxes change because it has not asked the engine to re-plan. Streamed plan/apply/verify phase transitions neither create nor replace final warning state. When live apply completes, its envelope replaces the preview result surface and its warning array becomes the only displayed list, including the case where warnings are omitted or empty. Resetting or starting a new preview clears the prior result as it already clears other result state.

Alternative considered: merge preview and apply warnings. Rejected because it duplicates stale advisories and obscures which engine run produced them.

### Warnings are advisory content, not outcome input

The warning list is visually amber and uses ordinary list semantics, not an assertive alert role. It is rendered near the result heading and above activity details. Warning presence never changes success labels, buttons, selection, action visibility, item classification, or summary counts.

Alternative considered: toast or `role="alert"`. Rejected because these warnings may accompany successful runs and do not require interruptive announcement.

### Type verify warnings without inventing a verify UI

`EndstateVerifyData` accepts optional warnings as a compile-time declaration of the engine's additive schema. Presentation remains limited to result surfaces that exist today: setup preview and live apply. This is deliberately partial GUI-contract coverage: the GUI does not invoke standalone `plan`, and its retained verify envelope has no visible result surface. Adding a launch banner or new verify screen would be a separate UX change with its own lifecycle and dismissal decisions.

## Risks / Trade-offs

- **Preview warnings can describe an item the user later unchecks** → Keep the full preview envelope advisory visible until apply; only a new engine run can authoritatively recalculate it.
- **Repeated engine warnings may look redundant** → Preserve them because silent deduplication would be non-deterministic and would discard engine output.
- **Unknown warning codes have no custom label** → Always show their engine-authored message; optional metadata supplies context without a client-side code map.
- **Verify warnings are declared but not visible** → Document this boundary explicitly and defer presentation until a real verify result surface exists.

## Migration Plan

The GUI is already pinned to engine 2.24. Older externally selected engines may omit `warnings`, which renders exactly the previous UI. Rollback is a normal revert of the GUI change; no stored state or engine migration is involved.

## Open Questions

None.
