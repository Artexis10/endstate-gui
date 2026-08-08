## ADDED Requirements

### Requirement: One-time post-capture cloud invitation

The GUI SHALL offer Endstate Cloud at most once, in the capture flow's saved completion state, and SHALL never present it automatically again once it has been presented or answered. The invitation SHALL NOT block, gate, or degrade any local behaviour.

#### Scenario: First saved capture

- **WHEN** a capture succeeds and the user saves it to a durable location for the first time
- **THEN** the saved completion state additionally displays the Endstate Cloud invitation
- **AND** the local completion actions remain available and unaffected

#### Scenario: Capture completed but not saved

- **WHEN** a capture succeeds and the user has not saved it
- **THEN** the invitation is not displayed

#### Scenario: Save dialog cancelled

- **WHEN** the user opens the save dialog and cancels it without saving
- **THEN** the invitation is not displayed

#### Scenario: Capture failed

- **WHEN** the capture fails
- **THEN** the invitation is not displayed

#### Scenario: Save failed

- **WHEN** saving the captured file fails
- **THEN** the invitation is not displayed

#### Scenario: Restore

- **WHEN** the user completes a restore or setup run
- **THEN** the invitation is not displayed

#### Scenario: Already presented

- **WHEN** the invitation has previously been presented, as recorded in persisted settings
- **THEN** it is not displayed again for any subsequent saved capture

#### Scenario: Second save in the same session

- **WHEN** the user saves another copy of the same capture after the invitation has been presented
- **THEN** the invitation is not presented a second time

### Requirement: Invitation is withheld from active subscribers

The GUI SHALL NOT present the invitation to a user who already has an active hosted-backup subscription. The subscriber test SHALL be the same condition the GUI uses to offer a manual hosted push: hosted backup supported AND signed in AND subscription status active.

#### Scenario: Active subscriber

- **WHEN** hosted backup is supported, the user is signed in, and the subscription status is active
- **THEN** the invitation is not displayed

#### Scenario: Signed in without an active subscription

- **WHEN** the user is signed in but the subscription status is not active
- **THEN** the invitation is displayed

#### Scenario: Signed out

- **WHEN** the user is not signed in to hosted backup
- **THEN** the invitation is displayed

#### Scenario: Engine without hosted-backup support

- **WHEN** the engine does not advertise hosted-backup support
- **THEN** the invitation is displayed
- **AND** its primary action routes to the hosted-backup pane, which explains that the bundled engine does not support hosted backup

### Requirement: One capture never produces two prompts

The GUI SHALL NOT present the cloud invitation while the one-time automatic-backup consent dialog is open or still owed for the same capture.

#### Scenario: Auto-backup consent is open

- **WHEN** the automatic-backup consent dialog is open when the capture is saved
- **THEN** the invitation is not displayed

#### Scenario: Auto-backup consent is still owed

- **WHEN** automatic backup is available and its one-time consent prompt has not yet been shown
- **THEN** the invitation is not displayed

#### Scenario: Auto-backup consent already answered

- **WHEN** the automatic-backup consent prompt has already been answered
- **THEN** the invitation is eligible on its own terms

### Requirement: Presentation is recorded before it is rendered

The GUI SHALL persist the invitation's shown-at timestamp before the invitation renders, so that an interrupted presentation is spent rather than pending. The persisted value SHALL be an ISO timestamp stored through the namespaced settings store, defaulting to null.

#### Scenario: Flag is written first

- **WHEN** the invitation becomes eligible on a successful save
- **THEN** the shown-at timestamp is persisted before the invitation card is in the document

#### Scenario: Interrupted presentation

- **WHEN** the application is reloaded after an invitation was displayed but never answered
- **THEN** a subsequent saved capture does not display the invitation

#### Scenario: Nothing recorded when ineligible

- **WHEN** the invitation is not eligible on a successful save
- **THEN** no shown-at timestamp is persisted

### Requirement: Any answer retires the invitation permanently

The GUI SHALL treat the primary action, the secondary action, and any dismissal as equivalent: each SHALL persist a dismissed flag that permanently prevents automatic presentation. Endstate Cloud SHALL remain reachable from the existing sidebar entry regardless.

#### Scenario: User keeps it local

- **WHEN** the user activates the secondary action
- **THEN** the dismissed flag is persisted
- **AND** the invitation is removed from the completion state

#### Scenario: User accepts the invitation

- **WHEN** the user activates the primary action
- **THEN** the dismissed flag is persisted
- **AND** the GUI routes to the existing hosted-backup pane rather than an external checkout

#### Scenario: Decision survives a reload

- **WHEN** the application is reloaded after the invitation was answered
- **THEN** a subsequent saved capture does not display the invitation

### Requirement: Invitation content is descriptive, not commercial

The invitation SHALL state that the setup is saved locally, report the captured application and settings counts from the canonical capture envelope, describe what Endstate Cloud does, and SHALL NOT display a price. It SHALL be announced politely to assistive technology, use the shared UI button primitives, and respect the reduced-motion preference.

#### Scenario: Counts come from the capture envelope

- **WHEN** the invitation is displayed
- **THEN** the application count is the canonical `appsIncluded` count
- **AND** the settings count is the same captured-settings count the capture summary displays

#### Scenario: No price is shown

- **WHEN** the invitation is displayed
- **THEN** no monetary amount or billing period appears anywhere in the card

#### Scenario: Announced without stealing focus

- **WHEN** the invitation is displayed
- **THEN** it is exposed with a status role and a polite live region
- **AND** it does not take focus or block the completion actions
