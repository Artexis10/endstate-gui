## Context

`config-generation-presentation` already renders engine-owned configuration resolutions verbatim, collects explicit target mappings, shows transient migration progress, and hides technical provenance behind a details disclosure. The engine varies `configResolutions[]` per captured config set, so a legacy bundle produces many rows that repeat the same `label` and `message`. The one-card-per-row layout is faithful but noisy, and the noise hides the rows that actually need a decision.

This change is presentation-only. The engine contract, shared types, CLI argument construction, capability gating, and the `restore-module-approval` consent lane are unchanged. Every sentence the GUI shows still comes from the engine; the only GUI-authored text added is structural (a count and section labels).

## Goals / Non-Goals

**Goals:**

- Collapse near-identical resolution rows into grouped cards so redundancy stops competing with decisions.
- Never merge or hide distinct engine copy, and never hide an engine-authored warning that must be seen before execution.
- Keep decision-bearing (ambiguous target) rows individually addressable and unchanged.
- Keep confirmations (`direct`) quiet.

**Non-Goals:**

- Changing engine copy, resolution semantics, terminal statuses, or provenance fields.
- Deriving compatibility, sorting, or selecting targets in the GUI.
- Filtering rows the engine returned; the GUI never second-guesses engine rows.

## Decisions

### Group by the composite `(resolution, label, message)` key

Grouping by `resolution` alone would be wrong: the engine varies `message` per underlying reason within one resolution kind, so grouping by kind would merge distinct engine sentences and hide copy. Grouping by `(resolution, label, message)` guarantees every card body is a single, verbatim engine message shared by all its members. Rows with distinct messages fall into distinct groups and render as separate cards. `remediation` can still vary within a group, so each distinct `remediation` renders once inside the card.

Group order follows first-occurrence order of the resolutions array; members within a group keep input order. The GUI adds only a `"{n} settings"` count and the member module display names (already engine-authored via `moduleDisplayNames`); no raw module id is ever synthesized into the distilled view.

### Exception: `ambiguous_target_instance` rows are never grouped

A row whose `reason` is `ambiguous_target_instance` carries the target-instance `Select` — it is decision-bearing, not redundant. These rows render as individual cards exactly as before (label, message, remediation, terminal status, per-row target selector, and per-row provenance disclosure). Collapsing them would hide or share a control that must be answered per capture, so they are split out before grouping and rendered verbatim.

### `direct` is a quiet line, not a card

The `direct` resolution ("Compatible") is a plain confirmation. Confirmations do not get attention weight, so a `direct` group renders as a single muted line with the engine `label`, no card border, no per-member status tag, and no provenance disclosure. Other resolution kinds (`migrate`, `incompatible`, `unknown`, `legacy_unverified`) always render group cards.

### One provenance disclosure per group card

Each group card holds a single "Configuration details" disclosure containing one section per member (module display name plus the existing `provenanceEntries()` output, keyed by capture and config-set id). Each member section keeps its `config-resolution-<captureId>` test hook for continuity; the group card adds `config-resolution-group-<resolution>`. As today, the disclosure only renders when the global "show details" setting is on, so the default view stays distilled.

### `legacy_unverified` warning stays at the top level

`restore-module-approval` requires the engine-authored `legacy_unverified` compatibility warning to be visible before execution. Because provenance lives inside a disclosure, the warning (label, message, remediation) is rendered at the top level of the group card — never inside the disclosure — so it is visible without any interaction. This keeps the pre-execution warning contract satisfied while the technical provenance stays progressive.

### Completed-apply list uses the same intent gate as preview

The preview path already gates the resolution list behind `restoreIntent === 'apps-and-settings' && configResolutions.length > 0`. The completed-apply path previously rendered the list unconditionally, so an install-only apply that happened to carry resolution data would surface configuration cards the user never opted into. The completed-apply render now uses the same gate. Rows are not filtered by status; the gate is only on restore intent and presence of rows.

## Risks / Trade-offs

- **[A group testid can repeat across distinct-message groups of the same kind]** → Intentional; distinct engine messages must stay in separate cards, and tests address them with `getAllByTestId` plus the message text. Uniqueness is not a presentation goal.
- **[A group hides how many distinct remediations exist]** → Mitigated by rendering each distinct `remediation` once, so no engine remediation copy is dropped.
- **[Members inside one group can have different terminal statuses]** → Each member's status is rendered at the top level of the group card, so no engine status is hidden by grouping.

## Migration Plan

Presentation-only; no data, profile, or engine migration. Rollback is reverting the component and the completed-apply gate. Older engines and config-free profiles are unaffected because the list still renders only when `configResolutions[]` is present under the settings intent.

## Open Questions

None.
