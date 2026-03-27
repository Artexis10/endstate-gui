# CLI Source of Truth

## Purpose

The CLI engine is the single source of truth for all system state. The GUI never fabricates, infers, or caches state independently. Every piece of data displayed to the user originates from a CLI invocation.

## Requirements

### Requirement: GUI never fabricates state

The GUI SHALL NOT generate capability statuses, verification results, or apply outcomes on its own. All displayed state must originate from CLI output.

#### Scenario: No synthetic status
- **WHEN** the GUI has not yet received CLI output for a capability
- **THEN** it displays a loading or unknown state
- **AND** never synthesizes a "pass", "fail", or "missing" status from its own logic

#### Scenario: No optimistic state updates
- **WHEN** a user initiates an apply action
- **THEN** the GUI does not pre-emptively mark capabilities as "applied" before the CLI reports completion
- **AND** waits for the CLI envelope to update displayed state

### Requirement: Displayed data refreshes from CLI on every action

The GUI SHALL re-derive all displayed data from CLI output each time an engine command completes. It does not carry forward stale results across invocations.

#### Scenario: Verify after apply
- **WHEN** an apply operation completes and a verify operation is subsequently run
- **THEN** the GUI replaces all previously displayed verify results with the new CLI output
- **AND** does not merge or blend old and new results
