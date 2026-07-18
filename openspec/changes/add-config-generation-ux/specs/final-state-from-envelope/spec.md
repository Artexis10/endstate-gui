## MODIFIED Requirements

### Requirement: Final state comes from the result envelope

The GUI SHALL update its authoritative state (capability statuses, verification results, apply outcomes, configuration resolutions, and configuration terminal statuses) only from the `EndstateEnvelope<T>` emitted when a CLI command completes. Configuration streaming events SHALL remain transient even when they report resolution, migration completion, failure, or rollback.

#### Scenario: Streaming events do not set final state

- **WHEN** the CLI emits streaming NDJSON log events during execution
- **THEN** the GUI uses them for live progress display (activity feed, counters, and migration progress)
- **AND** does not commit them as the final source of truth for capability or configuration outcomes

#### Scenario: Envelope replaces displayed state

- **WHEN** the CLI emits a `CliEnvelopeEvent` at command completion
- **THEN** the GUI replaces its current state for that command with the envelope's `data` field
- **AND** the envelope's `success` field determines the overall operation outcome
- **AND** envelope `configResolutions[]` determine every displayed configuration terminal status

#### Scenario: Rollback event does not predict terminal status

- **WHEN** streaming reports rollback progress for a configuration set
- **THEN** the GUI waits for the final envelope before displaying `rolled_back` or `rollback_failed` as its terminal state
