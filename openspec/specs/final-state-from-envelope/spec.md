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
