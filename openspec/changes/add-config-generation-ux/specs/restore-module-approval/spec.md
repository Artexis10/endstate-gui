## MODIFIED Requirements

### Requirement: Per-module restore selection during Apply

When the user selects "Install apps and restore settings" and modules are available, the GUI SHALL display per-module checkboxes and pass selection as --restore-filter. Every module SHALL remain unchecked until the user explicitly selects it. When a selected module has an engine-reported `legacy_unverified` resolution, that same unchecked module selection SHALL be the explicit consent to use the legacy restore lane, and the GUI SHALL display the engine-authored compatibility warning before execution. The GUI SHALL NOT require an additional expert flag or silently exclude legacy modules.

#### Scenario: Module selector appears with all unchecked

- **GIVEN** preview result contains restoreModulesAvailable with entries
- **WHEN** user selects "Install apps and restore settings"
- **THEN** ConfigModuleSelector renders with all modules unchecked

#### Scenario: Selected modules passed as --restore-filter

- **GIVEN** user has checked modules "vscode" and "git" in the selector
- **WHEN** user clicks Apply
- **THEN** engine command includes `--enable-restore --restore-filter vscode,git`

#### Scenario: No modules selected omits --enable-restore

- **GIVEN** user has "apps and settings" intent but zero modules checked
- **WHEN** user clicks Apply
- **THEN** engine command does NOT include `--enable-restore`
- **AND** apply proceeds as install-only

#### Scenario: No available modules hides selector

- **GIVEN** preview result has no restoreModulesAvailable or empty array
- **WHEN** restore intent is "apps and settings"
- **THEN** ConfigModuleSelector is not rendered

#### Scenario: Display names from configModuleMap

- **GIVEN** preview result contains configModuleMap with displayName fields
- **WHEN** ConfigModuleSelector renders
- **THEN** human-readable display names are shown

#### Scenario: Legacy module remains available but unchecked

- **GIVEN** preview reports a module resolution as `legacy_unverified`
- **WHEN** user selects "Install apps and restore settings"
- **THEN** the GUI displays the engine-authored compatibility warning for that module
- **AND** leaves the module unchecked
- **AND** permits the user to select it explicitly

#### Scenario: Unselected legacy module remains install-only

- **GIVEN** a legacy module is available and remains unchecked
- **WHEN** user clicks Apply
- **THEN** the GUI does not include that module in `--restore-filter`
- **AND** does not enable restore solely because the legacy payload exists
