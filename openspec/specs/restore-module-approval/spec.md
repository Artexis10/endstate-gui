# restore-module-approval Specification

## Purpose

Defines per-module restore selection during Apply.

## Requirements

### Requirement: Per-module restore selection during Apply

When the user selects "Install apps and restore settings" and modules are available, the GUI SHALL display per-module checkboxes and pass selection as --restore-filter.

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
