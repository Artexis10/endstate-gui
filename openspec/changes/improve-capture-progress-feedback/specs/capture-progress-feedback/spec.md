## ADDED Requirements

### Requirement: Capture feedback is visible immediately

The Save flow SHALL show an active, indeterminate capture treatment from the moment the user starts capture until the engine returns a terminal result.

#### Scenario: Capture starts before any streamed item

- **WHEN** the user starts capture and no item or progress event has arrived
- **THEN** the Save flow displays “Starting capture…” with an indeterminate activity treatment
- **AND** it does not render a blank or apparently frozen capture state

#### Scenario: Older engine emits no progress events

- **WHEN** capture is running against an engine that emits phase and item events but no progress events
- **THEN** the immediate fallback feedback remains visible until terminal success or failure
- **AND** final state still comes from the engine result envelope

### Requirement: Capture stage copy reflects engine progress

The GUI SHALL derive the active capture stage only from supported engine `progress` events and SHALL translate stage keys into user-facing copy.

#### Scenario: Inventory stage arrives

- **WHEN** the GUI receives a capture progress event with stage `inventory`
- **THEN** it displays “Checking installed apps…”

#### Scenario: Settings stage arrives

- **WHEN** the GUI receives a capture progress event with stage `settings`
- **THEN** it displays “Collecting app settings…”

#### Scenario: Packaging stage arrives

- **WHEN** the GUI receives a capture progress event with stage `packaging`
- **THEN** it displays “Packaging your setup…”

#### Scenario: Item event arrives within a stage

- **WHEN** an app item event arrives after a supported progress stage
- **THEN** the item is added to live activity
- **AND** the active stage copy is not replaced by a generic scanning message

#### Scenario: Unknown progress stage arrives

- **WHEN** the GUI receives a capture progress event with an unrecognized future stage
- **THEN** it ignores that stage safely
- **AND** it preserves the last recognized stage or the fallback state

### Requirement: Long-running capture is explained without fake precision

The Save flow SHALL display elapsed time during capture and SHALL add a reassurance after eight seconds without calculating or displaying a completion percentage.

#### Scenario: Capture is still running at eight seconds

- **WHEN** capture has been running for at least eight seconds without a terminal result
- **THEN** the GUI displays “Still working — your package manager can take 20 seconds or more on systems with many apps.”
- **AND** it continues to show indeterminate progress with elapsed time

#### Scenario: Capture finishes

- **WHEN** capture succeeds, fails, is reset, or the progress component unmounts
- **THEN** its elapsed-time interval is cleared
- **AND** no stale capture timer updates occur

#### Scenario: Accessible stage updates

- **WHEN** the active stage changes
- **THEN** the stage copy is announced through a polite live region
- **AND** the elapsed timer is not announced every second

### Requirement: Legacy captured items remain detected

The GUI SHALL treat the deprecated item status `captured` as a detected app only in the capture phase, and SHALL NOT classify malformed unknown statuses as exclusions.

#### Scenario: Legacy capture item is received

- **WHEN** a capture item event has status `captured`
- **THEN** the GUI renders the item as **Detected**
- **AND** it never renders that item as **Excluded**

#### Scenario: Canonical capture item is received

- **WHEN** a capture item event has status `present` and reason `detected`
- **THEN** the GUI renders the item as **Detected**

#### Scenario: Unknown item status is received

- **WHEN** an item event contains a status outside the canonical wire statuses and deprecated `captured`
- **THEN** the parser rejects the item event safely
- **AND** the GUI does not render it as **Excluded**
