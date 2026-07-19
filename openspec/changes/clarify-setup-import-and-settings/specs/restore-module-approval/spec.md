## MODIFIED Requirements

### Requirement: Per-module restore selection during Apply

When the user selects **Install apps and restore settings**, the GUI SHALL request a fresh restore-enabled preview before presenting module approval. When that matching preview reports modules, the GUI SHALL display per-module checkboxes and pass explicit selections as `--restore-filter`. Every module SHALL remain unchecked until the user explicitly selects it. When a selected module has an engine-reported `legacy_unverified` resolution, that same unchecked module selection SHALL be the explicit consent to use the legacy restore lane, and the GUI SHALL display the engine-authored compatibility warning before execution. The GUI SHALL NOT reuse module, target, or compatibility state from an install-only or different-profile preview, require an additional expert flag, or silently exclude legacy modules.

#### Scenario: Restore intent requests a matching preview
- **GIVEN** the current result came from an install-only preview
- **WHEN** the user selects **Install apps and restore settings**
- **THEN** the GUI requests one fresh dry run with `--enable-restore`
- **AND** clears stale module approvals, target mappings, and compatibility rows while that preview runs

#### Scenario: Module selector appears with all unchecked
- **GIVEN** the restore-enabled preview result contains `restoreModulesAvailable` entries
- **WHEN** that matching preview completes
- **THEN** ConfigModuleSelector renders with all modules unchecked

#### Scenario: Application curation survives settings preview
- **GIVEN** the user curated the installable application selection before enabling restore
- **WHEN** the matching restore-enabled preview completes for the same profile
- **THEN** application selections whose stable IDs remain present are preserved
- **AND** new or missing IDs are reconciled without guessing package identity

#### Scenario: Selected modules passed as --restore-filter
- **GIVEN** the user has checked modules `vscode` and `git` in the selector
- **WHEN** the user clicks Apply
- **THEN** the engine command includes `--enable-restore --restore-filter vscode,git`

#### Scenario: No modules selected omits --enable-restore
- **GIVEN** the user has **Install apps and restore settings** intent but zero modules checked
- **WHEN** the user clicks Apply
- **THEN** the engine command does NOT include `--enable-restore`
- **AND** apply proceeds as install-only

#### Scenario: No available modules hides selector
- **GIVEN** the matching restore-enabled preview has no `restoreModulesAvailable` entries
- **WHEN** restore intent is **Install apps and restore settings**
- **THEN** ConfigModuleSelector is not rendered

#### Scenario: Display names from restoreModulesAvailable
- **GIVEN** the matching restore-enabled preview contains `restoreModulesAvailable[].displayName` values
- **WHEN** ConfigModuleSelector renders
- **THEN** those human-readable display names are shown

#### Scenario: Legacy module remains available but unchecked
- **GIVEN** the matching restore-enabled preview reports a module resolution as `legacy_unverified`
- **WHEN** the settings selector renders
- **THEN** the GUI displays the engine-authored compatibility warning for that module
- **AND** leaves the module unchecked
- **AND** permits the user to select it explicitly

#### Scenario: Unselected legacy module remains install-only
- **GIVEN** a legacy module is available and remains unchecked
- **WHEN** the user clicks Apply
- **THEN** the GUI does not include that module in `--restore-filter`
- **AND** does not enable restore solely because the legacy payload exists

#### Scenario: Switching back to apps only clears restore consent
- **GIVEN** one or more modules or restore targets were selected
- **WHEN** the user selects **Install apps only** or loads another profile
- **THEN** selected modules and restore targets are cleared
- **AND** a later restore-enabled preview begins with every module unchecked
