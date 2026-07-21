## ADDED Requirements

### Requirement: Capture progress separates engine truth from presentation

The GUI SHALL use engine progress events as the only authority for the active capture work stage while retaining responsibility for user-facing wording, elapsed-time presentation, and accessibility.

#### Scenario: Engine reports capture stage

- **WHEN** the engine emits a supported capture progress stage
- **THEN** the GUI displays the locally defined copy for that stage
- **AND** it does not infer a different stage from elapsed time, item count, or unstructured stderr

#### Scenario: GUI explains a slow operation

- **WHEN** capture exceeds the GUI's reassurance threshold
- **THEN** the GUI may add generic timing guidance
- **AND** the guidance does not claim that engine work advanced or estimate a completion percentage
