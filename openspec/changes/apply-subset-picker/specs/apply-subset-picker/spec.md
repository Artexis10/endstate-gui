# Apply Subset Picker

Per-app selection in the setup flow's preview, consuming the engine's `apply --only <id[,id...]>` (engine change `apply-app-subset`). The picker is presentation-only: checkbox state re-slices engine-reported counts and is translated into manifest app ids on the apply invocation; all planning stays in the engine (CLI is source of truth).

## ADDED Requirements

### Requirement: Picker is dark without the engine capability

The GUI SHALL render the per-app picker (row checkboxes, selection header, select-all/none) only when the engine capabilities list `--only` under `commands.apply.flags`. Without it the preview SHALL render exactly as before and the apply invocation SHALL be unchanged.

#### Scenario: Engine predates apply --only
- **GIVEN** a capabilities envelope whose `commands.apply.flags` lacks `--only`
- **WHEN** a preview completes
- **THEN** no checkboxes or selection affordances are rendered
- **AND** Apply invokes the engine without `--only`

#### Scenario: Capability probe defaults safe
- **WHEN** capabilities are null, `commands` is missing or list-shaped, or `apply.flags` lacks `--only`
- **THEN** `engineSupportsApplyOnly` returns false

#### Scenario: Preview without envelope actions stays dark
- **GIVEN** the capability is advertised but the preview result carries no envelope actions
- **WHEN** the preview renders
- **THEN** the picker is not shown (rows cannot be mapped to manifest app ids)

### Requirement: Every installable preview row is selectable, defaulting to checked

In the preview-done phase, each app row backed by an envelope action with a manifest `id` and a winget `ref` SHALL get a checkbox, all checked by default. A header SHALL show "N of M selected" with Select all / Select none affordances. Already-PRESENT apps SHALL be selectable exactly like TO INSTALL apps (unchecking one excludes it — and with it, its settings scope — from the run). Manual/config-only rows SHALL NOT get picker checkboxes; they remain governed by the restore-intent controls.

#### Scenario: Default selection after preview
- **WHEN** a preview completes against a capable engine
- **THEN** every installable row's checkbox is checked
- **AND** the header reads "M of M selected"

#### Scenario: Select none, then select all
- **WHEN** the user clicks "Select none"
- **THEN** all checkboxes uncheck and the header reads "0 of M selected"
- **WHEN** the user clicks "Select all"
- **THEN** all checkboxes re-check

#### Scenario: A PRESENT app can be excluded
- **GIVEN** an app the preview reports as already present
- **WHEN** the user unchecks it
- **THEN** the checkbox responds like any other row and the app is excluded from the subset

### Requirement: Selection re-slices summary counts client-side

Unchecking apps SHALL update the preview's summary counts display ("N to install, M already present" and the count chips) by re-slicing the engine-reported per-app statuses over the checked set. This is presentation only — the GUI SHALL NOT compute any plan; the engine re-plans the subset on apply.

#### Scenario: Counts follow the selection
- **GIVEN** a preview of 2 to install and 1 present
- **WHEN** the user unchecks one to-install app
- **THEN** the summary shows "1 to install, 1 already present"

### Requirement: Apply passes the subset as manifest app ids via --only

When a strict subset is selected, Apply SHALL pass `--only` with the comma-separated manifest app `id` values (from the preview envelope's `data.actions[].id` — never winget refs or display names), including ALL manual/config-only app ids so settings composition matches an unfiltered run. When every app is selected the flag SHALL be omitted entirely. Restore intent options (`--enable-restore`, `--restore-filter`) SHALL compose unchanged with the subset.

#### Scenario: Strict subset
- **GIVEN** apps `git-git`, `7zip-7zip`, `firefox` with `7zip-7zip` unchecked
- **WHEN** the user applies
- **THEN** the invocation includes `--only git-git,firefox`

#### Scenario: Manual apps ride along
- **GIVEN** the preview also contains a manual/config-only app `lightroom`
- **WHEN** a subset apply runs
- **THEN** `lightroom` is included in the `--only` list even though it has no checkbox

#### Scenario: All selected is identical to today
- **WHEN** the user applies with every app checked
- **THEN** the invocation contains no `--only` flag

#### Scenario: Subset composes with settings restore
- **GIVEN** restore intent "apps and settings" with module `git` selected and app `firefox` unchecked
- **WHEN** the user applies
- **THEN** the invocation carries `--enable-restore --restore-filter git` AND `--only` without `firefox`

### Requirement: An empty selection can never reach the engine

With zero apps selected the Apply button SHALL be disabled. Independently, the `--only` value builder SHALL return null for an empty/blank id list so the flag is omitted rather than emitted blank (the engine rejects a blank `--only` with `MANIFEST_VALIDATION_ERROR`).

#### Scenario: Zero selected disables Apply
- **WHEN** the user clicks "Select none"
- **THEN** the Apply button is disabled

#### Scenario: Builder refuses blank values
- **WHEN** the id list is empty or contains only blank entries
- **THEN** `buildOnlyFlagValue` returns null and no `--only` is emitted

### Requirement: Foreign flows are unaffected

The undo/revert flow and all non-setup apply paths SHALL be untouched by the picker.

#### Scenario: Undo settings unchanged
- **WHEN** the user runs "Undo changes"
- **THEN** the revert invocation is identical to before this change
