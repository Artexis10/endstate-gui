# GUI Thin Layer

## Purpose

The GUI is a thin presentation layer. It contains no provisioning logic, no package management, no system mutation. All business logic lives in the Endstate CLI engine.
## Requirements
### Requirement: GUI contains zero provisioning logic

The GUI SHALL NOT implement any logic that installs, configures, removes, or verifies software on the system. All such operations are delegated to the CLI engine.

#### Scenario: No direct system mutation
- **WHEN** any GUI component triggers a provisioning operation (apply, verify, capture, restore)
- **THEN** the operation is performed exclusively by spawning the CLI engine as a child process
- **AND** the GUI never calls OS APIs, registry APIs, or package manager APIs directly

#### Scenario: No inline business rules
- **WHEN** the GUI receives structured data from the engine
- **THEN** it renders the data as-is without applying its own rules for status classification, dependency resolution, or capability ordering

### Requirement: GUI responsibilities are limited to presentation and invocation

The GUI SHALL only be responsible for: rendering UI, collecting user input, invoking the CLI, parsing CLI output, and displaying results.

#### Scenario: User triggers an action
- **WHEN** a user clicks an action button (e.g., Apply, Verify, Capture)
- **THEN** the GUI constructs CLI arguments from user input and invokes the engine
- **AND** displays progress from streaming output and final state from the result envelope

### Requirement: Command warnings remain engine-authored

The GUI SHALL treat each command warning as presentation data from the engine. It SHALL NOT infer package equivalence, perform fuzzy or normalized matching, correlate warnings with items, deduplicate warnings, reroute entries, select a preferred driver, rewrite warning messages, or mutate command outcomes from warning content.

#### Scenario: Possible duplicate crosses package drivers
- **WHEN** the engine reports `possible_duplicate` for entries routed to Chocolatey and winget
- **THEN** the GUI displays the engine-authored advisory
- **AND** makes no independent decision about whether the entries are the same product
- **AND** does not choose, remove, or reroute either entry

#### Scenario: Repeated and unknown warnings
- **WHEN** the engine reports repeated warnings or a warning with an unfamiliar code
- **THEN** the GUI preserves every message without client-side mapping or suppression
