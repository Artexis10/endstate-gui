# JSON Contract

## Purpose

The GUI invokes the CLI exclusively with the `--json` flag and relies entirely on structured JSON output for all data exchange. No human-readable CLI output is parsed for state.

## Requirements

### Requirement: All CLI invocations include --json

The GUI SHALL pass the `--json` flag on every CLI invocation. There are no code paths that invoke the engine without it.

#### Scenario: Engine run includes --json
- **WHEN** the Rust backend constructs a CLI command via `build_engine_command()`
- **THEN** the `--json` flag is present in the argument list
- **AND** the engine produces NDJSON streaming output followed by a JSON envelope

#### Scenario: No plain-text parsing for state
- **WHEN** the GUI receives CLI output
- **THEN** it parses each line as JSON (NDJSON log events or final envelope)
- **AND** never uses regex or string matching on human-readable text to extract state

### Requirement: Unstructured output is treated as opaque

The GUI SHALL treat any non-JSON output from the CLI (stderr, malformed lines) as opaque diagnostic text, never deriving application state from it.

#### Scenario: Stderr is not parsed for status
- **WHEN** the CLI writes to stderr
- **THEN** the GUI may display it in a log or diagnostic area
- **AND** does not extract status, error codes, or capability results from it
