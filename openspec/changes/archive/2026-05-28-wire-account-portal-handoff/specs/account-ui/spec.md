# account-ui delta

## MODIFIED Requirements

### Requirement: Account section in settings

The settings page SHALL render an Account section when `capabilities.features.hostedBackup.supported === true` AND the user is signed in. The section SHALL display the user's email (read-only), the current subscription status, a Manage subscription button, and a Sign out button.

#### Scenario: Signed-in account section
- **GIVEN** the user is signed in
- **WHEN** they navigate to settings
- **THEN** an Account section is visible
- **AND** it shows `status.email`
- **AND** it shows a subscription pill matching `status.subscriptionStatus`
- **AND** a Manage subscription button is available — clicking it invokes `endstate backup browser-session`, composes `${accountUrl}?session=${sessionToken}`, and opens the resulting URL via the OS shell (matching the backup-pane Manage flow; see hosted-backup contract §5)
- **AND** while the engine round-trip is in flight the button is disabled and reads "Opening…"

#### Scenario: Hidden when signed out or unsupported
- **GIVEN** the user is signed out OR the engine does not advertise `features.hostedBackup.supported`
- **WHEN** they navigate to settings
- **THEN** the Account section is not rendered

#### Scenario: Manage handoff AUTH_REQUIRED
- **GIVEN** the engine reports `AUTH_REQUIRED` from the `backup browser-session` call
- **WHEN** the click handler catches the error
- **THEN** it does NOT call `openExternal`
- **AND** it invokes `onAuthLost` (when wired by the parent); the parent routes to the inline re-auth dialog

#### Scenario: Manage handoff backend failure
- **GIVEN** the engine returns a non-AUTH_REQUIRED error from `backup browser-session`
- **WHEN** the click handler catches the error
- **THEN** it shows a friendly toast via `friendlyBackupError`
- **AND** no URL is opened
