## ADDED Requirements

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
