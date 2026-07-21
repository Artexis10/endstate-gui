## MODIFIED Requirements

### Requirement: GUI Renders Engine-Owned Config Resolution Results

When an apply preview or completed apply envelope contains `configResolutions[]`, the GUI SHALL render each resolution's engine-authored `label`, `message`, nullable `remediation`, and terminal `status` without mapping or rewriting them. The GUI SHALL NOT derive compatibility from application versions, generations, target candidates, migration paths, module definitions, or reason codes. For a completed apply, the GUI SHALL present `configResolutions[]` only when the restore intent is "apps-and-settings", matching the preview path; an install-only apply SHALL NOT present configuration cards even when the envelope carries resolution data. The GUI SHALL NOT filter rows by terminal status. When the envelope omits configuration fields, the existing config-free presentation SHALL remain unchanged.

#### Scenario: Four distilled states are rendered from the engine

- **WHEN** the engine supplies direct, migrate, unknown or legacy-unverified, and incompatible rows with the labels Compatible, Will be upgraded, Compatibility unknown, and Not supported
- **THEN** the GUI displays those supplied labels and messages verbatim
- **AND** does not reconstruct them from each row's resolution value

#### Scenario: Completed rollback result remains engine-owned

- **WHEN** the final envelope reports `status: "rolled_back"` or `status: "rollback_failed"`
- **THEN** the GUI displays that terminal status with the engine's message and remediation
- **AND** does not replace the primary failure reason with a GUI-authored rollback classification

#### Scenario: Config-free input keeps the existing view

- **WHEN** an apply envelope omits configuration-resolution fields
- **THEN** the GUI does not render an empty configuration-resolution section
- **AND** existing application preview and result behavior remains available

#### Scenario: Install-only apply presents no configuration cards

- **WHEN** a completed apply envelope carries `configResolutions[]` but the restore intent is "apps-only"
- **THEN** the GUI does not present any configuration resolution cards
- **AND** the application result summary remains available

## ADDED Requirements

### Requirement: GUI Groups Redundant Config Resolutions

The GUI SHALL group configuration resolutions by the composite key of `resolution`, `label`, and `message`, and render one card per group. A group card SHALL show the engine `label` as its heading, a GUI-authored count of member settings, the member module display names, the engine `message` once, each distinct engine `remediation` once, and each member's terminal `status`. The only GUI-authored text SHALL be the count and structural section labels; every other displayed sentence SHALL be engine copy rendered verbatim. Resolutions with distinct engine `message` values SHALL fall into distinct groups and SHALL NOT be merged. A row whose `reason` is `ambiguous_target_instance` SHALL be excluded from grouping and rendered as an individual decision card. A `direct` resolution group SHALL render as a single quiet line without card chrome or a status tag.

#### Scenario: Repeated same-verdict rows collapse into one card

- **WHEN** the engine supplies ten `legacy_unverified` rows sharing one label and one message
- **THEN** the GUI renders a single group card for those rows
- **AND** shows the shared engine message once and a count of ten settings

#### Scenario: Distinct engine messages stay in separate cards

- **WHEN** two rows share a resolution and label but carry different engine messages
- **THEN** the GUI renders one card per message
- **AND** does not merge the distinct engine copy

#### Scenario: Ambiguous target rows stay individual

- **WHEN** rows report `ambiguous_target_instance`
- **THEN** the GUI renders each such row as its own card with its own target selector
- **AND** does not collapse them into a group even when their label and message match

#### Scenario: Direct confirmations render as a quiet line

- **WHEN** the engine supplies `direct` "Compatible" rows
- **THEN** the GUI renders a single muted line for that group
- **AND** shows no card border and no terminal status tag

#### Scenario: Grouped provenance stays behind one disclosure

- **WHEN** a group card renders and the show-details setting is on
- **THEN** the GUI exposes one "Configuration details" disclosure containing a section per member
- **AND** each member section keeps its portable provenance collapsed until requested

#### Scenario: Legacy warning stays visible before execution

- **WHEN** a `legacy_unverified` group card renders
- **THEN** the engine-authored warning label, message, and remediation are visible at the top level of the card
- **AND** are not placed inside the provenance disclosure
