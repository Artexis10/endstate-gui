# Errors from Engine

## Purpose

All errors displayed to the user originate from the engine's JSON envelope. The GUI displays error messages verbatim and does not rewrite, summarize, or fabricate error text.

## Requirements

### Requirement: Error messages come from the engine envelope

The GUI SHALL extract error information exclusively from the `error` field of the `EndstateEnvelope` and display it to the user as-is.

#### Scenario: Engine error displayed verbatim
- **WHEN** the CLI returns an envelope with `success: false` and an `error` field
- **THEN** the GUI displays the `error` value to the user without modification
- **AND** does not append, prepend, or rephrase the error message

#### Scenario: No GUI-fabricated error messages for engine failures
- **WHEN** the engine reports a failure in its envelope
- **THEN** the GUI does not substitute its own error message in place of the engine's
- **AND** does not display generic fallback text when a specific engine error is available

### Requirement: Non-envelope errors are clearly distinguished

The GUI SHALL distinguish between errors reported by the engine (in the envelope) and transport-level errors (process crash, spawn failure, timeout) with clear labeling.

#### Scenario: Process spawn failure
- **WHEN** the CLI process fails to start (e.g., binary not found)
- **THEN** the GUI displays a transport-level error message
- **AND** clearly indicates this is a GUI-side issue, not an engine-reported error
