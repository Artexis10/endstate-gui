## ADDED Requirements

### Requirement: One captured-settings count across the capture completion surface

Every surface in the capture flow that reports how many settings were captured SHALL report the same number: the count of config modules the engine reports with status `captured`, falling back to the `configsIncluded` id list only when the engine omits structured config modules. The scan-complete headline, the settings filter chip, the per-app rows, and the post-capture cloud invitation SHALL NOT compute this number differently.

#### Scenario: Engine reports a module it did not capture

- **WHEN** the engine returns three `configsIncluded` ids but only two config modules with status `captured`
- **THEN** the scan-complete headline reads `2 settings captured`
- **AND** the settings filter chip reads `2 settings`
- **AND** the cloud invitation reports two supported settings

#### Scenario: Engine omits structured config modules

- **WHEN** the engine returns `configsIncluded` ids and no structured config modules
- **THEN** every surface falls back to the `configsIncluded` count

#### Scenario: No settings captured

- **WHEN** no config module was captured
- **THEN** the scan-complete headline omits the settings clause entirely
