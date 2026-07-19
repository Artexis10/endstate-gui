## Why

The repaired capture and setup flow now exposes the right engine data, but its presentation blurs three different facts: which apps Endstate can install, which settings it captured, and whether settings restore is enabled for the current preview. ZIP import also advances into setup preview without an explicit user action, while native drag-and-drop provides no reliable hover feedback in the packaged app.

## What Changes

- Preserve the existing Capture → Setup architecture, visual hierarchy, cards, colors, and restore-off-by-default safety model.
- Label captured application inventory, captured settings, and settings-only entries so the GUI never implies that Endstate can install an app when it only owns that app's settings payload.
- Keep setup previews install-only by default, replace restore-disabled per-module result cards with one concise settings-available callout, and run a fresh restore-enabled dry run when the user explicitly chooses to restore settings.
- Complete a valid ZIP or manifest import after transactional commit and exact discovery, keep the user on the profile list, highlight the imported profile, and require an explicit **Review setup** action before preview.
- Consolidate native drag lifecycle handling around the canonical Tauri runtime check so supported files show visible enter/over/leave/drop feedback and a drop starts exactly one import.
- Extend focused unit and Playwright coverage across capture labels, import-without-preview, explicit review, both restore intents, native drag state, apply, and undo.

## Capabilities

### New Capabilities

<!-- None. This change clarifies and corrects existing capture and setup capabilities. -->

### Modified Capabilities

- `capture-artifact-flow`: Replace the shipped automatic imported-profile activation contract with visible transactional import followed by explicit review, and extend the connected Capture-to-Undo regression.
- `intent-based-ux`: A successful import remains in the Setup profile list with an explicit Review setup action, and supported drag operations provide visible lifecycle feedback without starting preview implicitly.
- `config-only-visual-distinction`: Capture and Setup explicitly distinguish installable applications from settings-only payloads and explain the settings indicator.
- `restore-off-by-default`: The default setup preview remains install-only, restore intent is visible, and opting in requests a fresh restore-enabled preview before execution.
- `config-generation-presentation`: Configuration-resolution rows are shown only for the matching restore-enabled preview; restore-disabled previews use a concise settings-available summary instead of misleading skipped compatibility cards.
- `restore-module-approval`: Module selection is populated from the fresh restore-enabled preview and cannot reuse stale install-only preview state.

## Impact

- GUI state and presentation in `src/App.tsx` and the intent-flow components for Save, Setup, profile import, and drop feedback.
- Existing bridge invocation only: the GUI will pass the engine's current restore-enable option during the explicit settings dry run; no manifest, envelope, engine business-rule, or dependency change is planned.
- Unit tests and mocked Playwright journeys, including capture → save → import → explicit review → preview/apply → undo.
- Both shipped `fix-capture-save-import-flow` deltas are synced into the canonical `capture-artifact-flow` and `final-state-from-envelope` specs before this change replaces automatic preview. The older change remains unarchived until its outstanding verification and release tasks are independently confirmed, then is archived with `--skip-specs` because its requirements are already canonical; its transactional validation, exact discovery, and safe commit requirements remain intact.
