## ADDED Requirements

### Requirement: Visible command results present final-envelope warnings

The GUI SHALL present the optional `data.warnings` array from completed setup preview (`apply --dry-run`) and live apply envelopes that reach their existing success or partial-result surfaces. A missing or empty warning array SHALL render no warning region. Warning presence SHALL NOT change whether the result is presented as successful or partially failed. Hard-error surfaces that receive no setup result data are outside this requirement.

#### Scenario: Preview completes with warnings
- **WHEN** an `apply --dry-run` final envelope contains one or more warnings
- **THEN** the preview result surface displays those warnings
- **AND** retains its normal preview actions and controls

#### Scenario: Apply completes with warnings
- **WHEN** a live apply final envelope contains one or more warnings
- **THEN** the apply result surface displays those warnings
- **AND** retains its engine-authored outcome and item results

#### Scenario: Warning field is absent or empty
- **WHEN** the final envelope omits `data.warnings` or provides an empty array
- **THEN** the result surface renders no command-warning region

### Requirement: Warning presentation preserves engine content and cardinality

The GUI SHALL render every warning message verbatim, in array order, including identical warning objects. It SHALL display exact `driver` and `ref` values when present, without humanizing or substituting them, and SHALL NOT require a recognized `code` to display the message. The warning region SHALL have an accessible name and contain a semantic list without an assertive `alert` role.

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
- **THEN** the GUI displays the exact supplied metadata without deriving substitute labels or package identity

#### Scenario: Advisory accessibility semantics
- **WHEN** one or more command warnings are displayed
- **THEN** assistive technology can identify a named warning region and its semantic list
- **AND** the region and entries do not use an assertive `alert` role

### Requirement: Warnings remain advisory and independent of selection

Command warnings SHALL NOT change item visibility, item status, reason, actions, summary counts, apply availability, selected app IDs, command arguments, or driver routing. Preview warnings SHALL remain unchanged while the user changes the apply subset.

#### Scenario: Duplicate advisory does not suppress either package
- **GIVEN** a preview contains a `possible_duplicate` warning for entries routed to different drivers
- **WHEN** the preview renders
- **THEN** warning presentation does not suppress, remove, disable, or alter any item the result surface would otherwise present
- **AND** the preview's statuses and summary counts remain unchanged

#### Scenario: User changes the apply subset
- **GIVEN** a completed preview with warnings
- **WHEN** the user selects or unselects app rows without running the engine again
- **THEN** the preview warning entries retain identical messages, metadata, cardinality, and order

### Requirement: Warning lifecycle follows the producing result

The GUI SHALL show warnings only from the result currently being presented. A live apply result SHALL replace preview warnings rather than merge with them, and resetting or beginning a new setup result SHALL clear the prior warning list with the rest of that result state.

#### Scenario: Live apply replaces preview warnings
- **GIVEN** a preview displays warning list A
- **WHEN** live apply completes with warning list B
- **THEN** the result surface displays only list B
- **AND** does not retain or merge entries from list A

#### Scenario: Live apply clears preview warnings when none are returned
- **GIVEN** a preview displays warning list A
- **WHEN** live apply completes with `warnings` omitted or empty
- **THEN** the result surface renders no command-warning region
- **AND** does not retain entries from list A

#### Scenario: Reset clears warnings
- **GIVEN** a setup result displays warnings
- **WHEN** the user resets the flow or begins a new preview
- **THEN** warnings from the prior result are no longer displayed
