# config-generation-presentation Specification

## Purpose
Defines how the GUI presents engine-owned configuration compatibility, explicit target choices, transient migration progress, and portable provenance.

## Requirements
### Requirement: GUI Renders Engine-Owned Config Resolution Results

When an apply preview or completed apply envelope contains `configResolutions[]`, the GUI SHALL render each resolution's engine-authored `label`, `message`, nullable `remediation`, and terminal `status` without mapping or rewriting them. The GUI SHALL NOT derive compatibility from application versions, generations, target candidates, migration paths, module definitions, or reason codes. When the envelope omits configuration fields, the existing config-free presentation SHALL remain unchanged.

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

### Requirement: GUI Collects Explicit Target Mappings Without Guessing

When the engine reports `ambiguous_target_instance` and capabilities advertise `apply --restore-target`, the GUI SHALL offer the engine-provided target candidates without selecting a default, comparing versions, sorting by preference, or determining compatibility. Each explicit user choice SHALL be passed as a repeatable `--restore-target <captureId>=<targetInstanceId>` argument. No mapping argument SHALL be emitted for an untouched selector.

#### Scenario: Ambiguous target begins unselected

- **WHEN** a preview row reports `ambiguous_target_instance` with multiple target candidates
- **THEN** the target selector shows those candidates with no selected target
- **AND** the GUI does not prefer the highest, newest, or first version

#### Scenario: Multiple explicit mappings stay repeatable

- **WHEN** the user explicitly maps two captured config sets to two target instances and starts Apply
- **THEN** the engine command contains two separate `--restore-target` arguments
- **AND** each argument preserves the selected capture and target IDs

#### Scenario: Unsupported engine keeps target selection dark

- **WHEN** apply capabilities do not advertise `--restore-target`
- **THEN** the GUI does not show an interactive target selector
- **AND** still renders the engine's ambiguity label and message

#### Scenario: Invalid mapping error remains engine-authored

- **WHEN** the engine returns `INVALID_RESTORE_TARGET` with a message and remediation
- **THEN** the GUI displays that message and remediation unchanged

### Requirement: Migration Events Are Transient Engine-Authored Progress

During apply, the GUI SHALL display `config-resolution` and `config-migration` event messages as transient progress in stream order. It SHALL NOT interpret migration operations or translate staging, edge, validation, commit, or rollback into final outcomes.

#### Scenario: Forward migration progress stays ordered

- **WHEN** events report staging, multiple migration edges, validation, and commit
- **THEN** the GUI shows the engine-authored messages in event order
- **AND** uses no GUI-authored migration result in place of the final envelope

#### Scenario: Failure and rollback remain visible

- **WHEN** migration events report a failure followed by rollback progress
- **THEN** the GUI shows both engine-authored messages while the run is active
- **AND** waits for the command envelope to determine the terminal status

### Requirement: Config Provenance Uses Progressive Disclosure

The GUI SHALL hide technical configuration provenance from the default view and SHALL expose the engine-provided portable source instance, target candidates, versions, generations, migration path, fingerprints, module revisions, and reason through an explicit details disclosure. The GUI SHALL NOT expose or derive host-local roots.

#### Scenario: Default row stays distilled

- **WHEN** a configuration resolution first renders
- **THEN** its technical provenance is not expanded
- **AND** its engine-authored label and message remain visible

#### Scenario: User expands provenance

- **WHEN** the user opens the configuration row's details disclosure
- **THEN** the GUI displays the supplied portable provenance values
- **AND** does not infer additional compatibility or migration claims
