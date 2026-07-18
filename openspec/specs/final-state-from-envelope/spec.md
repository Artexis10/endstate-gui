# Final State from Envelope

## Purpose

The GUI derives final application state exclusively from the JSON envelope emitted at CLI command completion. Streaming NDJSON events are used only for transient progress display, never for final state.
## Requirements
### Requirement: Final state comes from the result envelope

The GUI SHALL update its authoritative state (capability statuses, verification results, apply outcomes) only from the `EndstateEnvelope<T>` emitted when a CLI command completes.

#### Scenario: Streaming events do not set final state
- **WHEN** the CLI emits streaming NDJSON log events during execution
- **THEN** the GUI uses them for live progress display (activity feed, counters)
- **AND** does not commit them as the final source of truth for capability outcomes

#### Scenario: Envelope replaces displayed state
- **WHEN** the CLI emits a `CliEnvelopeEvent` at command completion
- **THEN** the GUI replaces its current state for that command with the envelope's `data` field
- **AND** the envelope's `success` field determines the overall operation outcome

### Requirement: Streaming output is ephemeral

The GUI SHALL treat streaming log events as transient. They are displayed during execution and discarded or deprioritized once the envelope arrives.

#### Scenario: Progress UI resets on next run
- **WHEN** a new CLI command is started
- **THEN** the progress display from the previous run is cleared
- **AND** the new run's streaming events populate the progress UI fresh

### Requirement: Command warning state comes from the final envelope

The GUI SHALL derive command-warning presentation only from the completed command envelope. Streaming events and phase transitions SHALL NOT create or replace final warnings. When a subsequent completed command result reaches the same result surface, its warning array SHALL replace the previously displayed command-warning state.

#### Scenario: Streaming warning-like text is not final warning state
- **WHEN** a streaming log event contains warning-like text
- **THEN** the GUI may show it in transient activity
- **AND** does not add it to the final command-warning list

#### Scenario: Later envelope replaces warning state
- **GIVEN** the current result surface displays warnings from a completed preview envelope
- **WHEN** the live apply envelope arrives
- **THEN** the displayed command-warning state comes exclusively from the live apply envelope

#### Scenario: Streaming phase transition preserves final warning state
- **GIVEN** a completed preview result displays warnings
- **WHEN** a later run emits streamed plan, apply, or verify phase events before its final envelope
- **THEN** those phase transitions do not create or replace the final command-warning list
