## Context

The engine already captures config modules into zip bundles and returns structured config data in the capture envelope (`outputFormat`, `configsIncluded`, `configsSkipped`, `configsCaptureErrors`). The GUI currently ignores these fields — `EndstateCaptureData` has no config fields, and the capture result display only shows app counts.

This is Phase 1: read-only visibility of what the engine already produces. No config restore, no selective capture toggles.

## Goals / Non-Goals

**Goals:**
- Surface config module capture results in the GUI capture flow
- Extend type system to represent config fields from engine envelope
- Update capture summary text to mention configs when present
- Show config module breakdown in Capture Details modal

**Non-Goals:**
- Config restore flow (Phase 2)
- "Keep Settings" toggle / selective capture (`--WithConfig`)
- Config module catalog with display names (Phase 1 uses raw module IDs)
- Engine invocation changes (engine already auto-bundles)

## Decisions

### D1: Extend existing types rather than new interfaces

**Decision**: Add optional config fields directly to `EndstateCaptureData` and `ActionResult.counts`.

**Rationale**: The config data is part of the capture envelope — it's the same data source. A separate interface would add indirection without benefit. Optional fields preserve backward compatibility with engines that don't produce config data.

**Alternative considered**: New `ConfigCaptureData` interface composed into `EndstateCaptureData`. Rejected — adds complexity for 4 optional fields.

### D2: Config summary as suffix to existing summary text

**Decision**: Append ` · N configs included` to existing capture summary text when configs are present. Example: `"67 apps captured · 12 configs included"`.

**Rationale**: Keeps the primary summary compact. The config info is secondary to app count. The separator `·` matches existing UI patterns.

**Alternative considered**: Separate line for config summary. Rejected — overview card space is limited and this is supplementary info.

### D3: Config section renders below apps in details modal

**Decision**: Add a new `CaptureConfigSummary` component that renders below the apps list in `ActionDetailsModal`, only when `actionResult.action === 'capture'` and `outputFormat === 'zip'`.

**Rationale**: Config modules are a separate concern from apps. Rendering below the apps list maintains visual hierarchy (apps are primary). Conditional on `outputFormat === 'zip'` because jsonc output means no bundle was created (no config support in that mode).

### D4: Config helpers in capture-continuity.ts

**Decision**: Add `getCapturedConfigCount()` and extend `deriveCaptureSummaryText()` and `buildCaptureActionResult()` in the existing `capture-continuity.ts` module.

**Rationale**: This module already owns capture result logic (INV-CONTINUITY-1, INV-DETAILS-1). Config visibility is a natural extension.

### D5: Store config arrays on ActionResult for modal rendering

**Decision**: Add `configsIncluded`, `configsSkipped`, `configsCaptureErrors` string arrays to `ActionResult` (alongside existing `appEvents`).

**Rationale**: The modal needs the full lists (not just counts) to render each config module. Storing on `ActionResult` keeps the data flow consistent — same pattern as `appEvents`.

## Risks / Trade-offs

- **[Risk]** Engine may not produce config fields for older CLI versions → **Mitigation**: All fields are optional with `?`. GUI gracefully degrades to current behavior (no config section shown).
- **[Risk]** Config module IDs are cryptic (e.g., `vscode-extensions`) → **Mitigation**: Acceptable for Phase 1. Phase 2 can add display names from a module catalog.
- **[Trade-off]** ActionResult grows with config arrays → Acceptable: capture results are short-lived in-memory state, not persisted.
