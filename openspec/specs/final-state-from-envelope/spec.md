# Final State from Envelope

## Purpose

The GUI derives final application state exclusively from the JSON envelope emitted at CLI command completion. Streaming NDJSON events are used only for transient progress display, never for final state.

## Requirements

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

### Requirement: Activity rows reconcile into one envelope-authoritative row per item

The GUI SHALL reconcile live activity rows into the completed command envelope's authoritative action list so that each application renders exactly one row across the entire run (plan → apply → verify), even when apply and verify stream in a single spawn. Because the engine keys streamed item events by the package `ref` while envelope actions are keyed by the manifest `id`, the GUI SHALL match a live row to its envelope action by either identifier and collapse them into a single row. Live rows that correspond to no envelope action (for example config-restore rows) SHALL be preserved, not dropped.

#### Scenario: Same app streamed across apply and verify

- **WHEN** an app streams an item event during apply and another during verify, keyed by its package `ref`
- **AND** the completed envelope carries one action for that app keyed by its manifest `id`
- **THEN** the reconciled activity list shows exactly one row for that app
- **AND** the row reflects the envelope's authoritative terminal status

#### Scenario: Package ref differs from manifest id

- **WHEN** a live row is keyed by a package `ref` that differs from its envelope action's `id`
- **THEN** the GUI matches them by `ref` and renders a single row
- **AND** does not render the app twice (once per identifier)

#### Scenario: Restore rows survive reconciliation

- **WHEN** the live list contains config-restore rows that are absent from the envelope's app actions
- **THEN** the reconciled list still contains those restore rows
- **AND** the app rows equal the envelope actions with no residual duplicates
