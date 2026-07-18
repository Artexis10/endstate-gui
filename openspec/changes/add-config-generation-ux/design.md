## Context

The setup flow currently previews and applies profiles through `endstate apply`, keeps restore off by default, and collects module-level restore consent through unchecked checkboxes. The engine's additive schema-1.0 contract now exposes `configResolutions[]`, `configResolutionSummary`, repeatable `--restore-target`, and `config-resolution` / `config-migration` JSONL events. The GUI must consume these fields without becoming a second compatibility or migration engine.

The final command envelope remains authoritative. Streaming events can make staging, migration, commit, and rollback visible while a command runs, but they cannot determine completed outcomes. Older engines and config-free profiles omit the new fields, so existing behavior must remain unchanged when the capability or data is absent.

## Goals / Non-Goals

**Goals:**

- Present engine-authored configuration compatibility and execution outcomes in preview and completed setup views.
- Keep legacy settings available through explicit, unchecked module consent with the engine's warning visible.
- Let users resolve engine-reported side-by-side ambiguity through an explicit target choice and repeatable CLI arguments.
- Show engine-authored migration and rollback progress transiently.
- Make portable provenance inspectable without putting technical detail in the default view.
- Preserve engine errors, including remediation, without rewriting their copy.

**Non-Goals:**

- Detecting application versions, selecting generations, comparing versions, choosing a preferred target, or validating migration paths in the GUI.
- Interpreting module definitions, executing migration operations, or exposing host-local target roots.
- Adding a separate restore/rebuild workflow that the current GUI does not have.
- Changing the engine schema version or replacing existing behavior for older engines.

## Decisions

### Model the engine contract additively

The shared GUI types will add the exact resolution, summary, provenance, terminal-status, and streaming-event fields while keeping them optional on existing apply data. Config-free or older-engine envelopes therefore stay on the current path. This is preferred to a GUI-specific normalized model because normalization could silently reinterpret future additive engine fields.

### Keep module consent as the restore authority

The existing two-step opt-in remains: the user first selects apps and settings, then checks individual modules. All module checkboxes remain unchecked. A legacy resolution is displayed beside its module using the engine's `label`, `message`, and `remediation`; checking that module is the explicit legacy consent. No separate expert flag is introduced because the engine contract retains the existing consent lane for legacy input.

### Collect target mappings without resolving compatibility

A target selector appears only when the engine reports `reason: "ambiguous_target_instance"` and capabilities advertise `apply --restore-target`. The selector has no default. Candidate option text is composed only from the candidate's portable engine fields, without sorting or version comparison. Each explicit choice produces one `--restore-target` argument; the engine validates the mapping and final post-install target.

When capability support is absent, the selector stays dark and the engine's resolution message remains visible. An unresolved set may safely skip while independent application installation proceeds.

### Separate transient config progress from final resolution state

`config-resolution` and `config-migration` events are retained in a bounded, per-run transient collection and rendered using their engine-authored messages. The final results view reads only `configResolutions[]` and `configResolutionSummary` from the completed envelope. Starting another preview or apply clears transient config progress.

This is preferred to adapting config events into the existing app-event status mapper because that mapper authors GUI labels and would blur the engine-copy boundary.

### Use focused presentation components

Resolution rows, migration progress, and provenance disclosure will be small components consumed by the existing setup flow. Resolution rows render `label`, `message`, `remediation`, and terminal `status` unchanged. Provenance uses the existing details disclosure and displays raw portable fields, arrays, and evidence only when expanded.

### Preserve structured engine command errors

Apply failures with an envelope error will cross the setup-flow promise boundary in a typed wrapper whose `message` remains exactly the engine message and whose optional remediation is retained. The setup error view will render both fields unchanged. Transport errors remain separately generated GUI errors.

## Risks / Trade-offs

- **[A candidate ID is not a friendly name]** → Show available portable version/evidence fields with the ID, without inventing compatibility language or choosing a preferred candidate.
- **[Preview evidence can differ after installation]** → Keep preview informational; the engine re-detects and validates the explicit mapping during the live command.
- **[A module can contain several config sets]** → Keep consent module-scoped, but show each engine resolution separately and map targets by capture ID.
- **[Streaming can disagree with the terminal outcome]** → Remove transient progress from authority and always replace it with the final envelope result.
- **[Older engines omit new fields or flags]** → Gate target selection through capabilities and render the existing restore UI when config-resolution data is absent.

## Migration Plan

1. Ship additive GUI parsing and presentation after the engine contract is available.
2. Keep all new controls dark when fields or capabilities are absent.
3. Roll back the GUI feature by hiding the additive presentation; no profiles, bundles, or engine state require migration.

## Open Questions

None. The engine GUI, event, and CLI contracts define the required vocabulary and authority boundaries.
