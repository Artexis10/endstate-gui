## MODIFIED Requirements

### Requirement: Warning presentation preserves engine content and cardinality

The GUI SHALL render every warning message verbatim, in array order, including identical warning objects, as the visible line of each entry. It SHALL display exact `driver` and `ref` values when present, without humanizing or substituting them, only behind the Details disclosure that the "show details" setting controls; the default view SHALL NOT show them. It SHALL NOT require a recognized `code` to display the message. The warning region SHALL have an accessible name and contain a semantic list without an assertive `alert` role.

#### Scenario: Ordered duplicate warnings
- **GIVEN** a final envelope contains three warnings in which the first and third are identical
- **WHEN** the result surface renders them
- **THEN** all three messages appear in their original order
- **AND** neither identical warning is removed

#### Scenario: Unknown warning code
- **WHEN** a warning has a code the GUI does not recognize
- **THEN** its engine-authored message is still displayed verbatim

#### Scenario: Optional package context
- **WHEN** a warning includes `driver` or `ref`
- **THEN** the default view shows only the engine message
- **AND** with "show details" on, the Details disclosure displays the exact supplied metadata without deriving substitute labels or package identity

#### Scenario: Advisory accessibility semantics
- **WHEN** one or more command warnings are displayed
- **THEN** assistive technology can identify a named warning region and its semantic list
- **AND** the region and entries do not use an assertive `alert` role
