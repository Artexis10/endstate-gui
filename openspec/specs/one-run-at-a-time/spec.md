# One Run at a Time

## Purpose

Only one CLI engine process may be active at any time. The Rust backend enforces this with a mutex guard, preventing concurrent engine invocations that could corrupt system state.

## Requirements

### Requirement: Mutex guard prevents concurrent CLI execution

The Rust backend SHALL hold a mutex for the duration of any CLI engine process. A second invocation attempt while the mutex is held is rejected.

#### Scenario: Second invocation rejected while running
- **WHEN** an engine command is already in progress
- **AND** a second `engine_run` invocation is attempted
- **THEN** the second invocation returns an error immediately
- **AND** the first invocation continues uninterrupted

#### Scenario: Mutex released after completion
- **WHEN** a CLI engine process completes (success or failure)
- **THEN** the mutex is released
- **AND** a subsequent `engine_run` invocation proceeds normally

### Requirement: Cancellation releases the mutex

The system SHALL release the mutex when an engine process is cancelled, allowing a new invocation to proceed.

#### Scenario: Cancel then re-run
- **WHEN** a running engine process is cancelled via `engine_cancel`
- **THEN** the mutex is released after the process terminates
- **AND** a new `engine_run` invocation can proceed immediately
