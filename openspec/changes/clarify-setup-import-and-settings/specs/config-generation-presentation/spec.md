## MODIFIED Requirements

### Requirement: GUI Renders Engine-Owned Config Resolution Results

When the current preview or completed apply invocation includes configuration restore and its envelope contains `configResolutions[]`, the GUI SHALL render each resolution's engine-authored `label`, `message`, nullable `remediation`, and terminal `status` without mapping or rewriting them. A restore-disabled preview SHALL NOT present its per-module restore-disabled rows as compatibility outcomes; it SHALL use only an availability summary backed by engine-provided module data. A preview result SHALL be presented only when its profile, restore intent, and monotonically increasing request generation match the active request. The GUI SHALL NOT derive compatibility from application versions, generations, target candidates, migration paths, module definitions, or reason codes. When the envelope omits configuration fields, the existing config-free presentation SHALL remain unchanged.

#### Scenario: Four distilled states are rendered from the restore-enabled engine result
- **GIVEN** the active restore-enabled preview supplies direct, migrate, unknown or legacy-unverified, and incompatible rows with the labels Compatible, Will be upgraded, Compatibility unknown, and Not supported
- **WHEN** that matching preview result renders
- **THEN** the GUI displays those supplied labels and messages verbatim
- **AND** does not reconstruct them from each row's resolution value

#### Scenario: Restore-disabled rows use progressive disclosure
- **GIVEN** an install-only preview contains configuration rows whose engine message says restore is not enabled
- **WHEN** the install-only result renders
- **THEN** the GUI shows one settings-available-but-off summary instead of individual configuration-resolution cards
- **AND** makes no compatibility claim

#### Scenario: Stale restore results are cleared
- **GIVEN** configuration-resolution rows are visible for a restore-enabled preview
- **WHEN** the user switches profiles or returns to install-only intent
- **THEN** those rows and their target mappings are no longer presented as current

#### Scenario: Retried same-key preview cannot overwrite newer result
- **GIVEN** two preview requests have the same profile and restore intent but different request generations
- **WHEN** the older generation resolves after the newer active request
- **THEN** the GUI ignores the older response
- **AND** presents state only from the active generation when it completes

#### Scenario: Completed rollback result remains engine-owned
- **WHEN** a restore-enabled final envelope reports `status: "rolled_back"` or `status: "rollback_failed"`
- **THEN** the GUI displays that terminal status with the engine's message and remediation
- **AND** does not replace the primary failure reason with a GUI-authored rollback classification

#### Scenario: Config-free input keeps the existing view
- **WHEN** an apply envelope omits configuration-resolution fields
- **THEN** the GUI does not render an empty configuration-resolution section
- **AND** existing application preview and result behavior remains available
