## MODIFIED Requirements

### Requirement: Streaming output is ephemeral

The GUI SHALL treat streaming log events as transient. They are displayed during execution and discarded or deprioritized once the envelope arrives. Transient rendering MUST preserve the semantic meaning of known engine events: a successful capture item (`present` with reason `detected`, or compatibility status `captured`) SHALL NOT be presented as skipped or excluded. Authoritative captured app and configuration contents SHALL still come only from the final envelope.

#### Scenario: Progress UI resets on next run
- **WHEN** a new CLI command is started
- **THEN** the progress display from the previous run is cleared
- **AND** the new run's streaming events populate the progress UI fresh

#### Scenario: Successful capture progress stays truthful
- **WHEN** streaming reports a successful captured item before the final envelope
- **THEN** the transient row is presented as detected
- **AND** the GUI waits for the final envelope before committing captured contents
