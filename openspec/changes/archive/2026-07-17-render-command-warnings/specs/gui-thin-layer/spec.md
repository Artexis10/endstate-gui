## ADDED Requirements

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
