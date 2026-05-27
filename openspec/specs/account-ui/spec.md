# account-ui Specification

## Purpose

Defines the Account section in settings for users of Hosted Backup. Covers visibility, subscription status display, sign-out, and GDPR account deletion (per hosted-backup contract §12). The section is gated on engine support for hosted backup and on the user being signed in.

## Requirements

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

### Requirement: Sign out

The Sign out button SHALL invoke `endstate backup logout`, on success show a toast "Signed out" and route the user to the auth pane.

#### Scenario: Sign out success
- **GIVEN** the user clicks Sign out in the Account section
- **WHEN** `backupLogout` returns `success: true`
- **THEN** a toast displays "Signed out"
- **AND** the app routes to the auth pane

### Requirement: Account deletion confirmation

The Delete account button SHALL open a modal that requires the user to type their email address before the Confirm button enables. The Confirm action SHALL invoke `endstate account delete --confirm` and on success route to a signed-out state.

#### Scenario: Confirm disabled until email matches
- **GIVEN** the delete account modal is open
- **AND** `status.email = "user@example.com"`
- **WHEN** the user types `user@example.co`
- **THEN** the Confirm button remains disabled

#### Scenario: Confirm enables on exact match
- **GIVEN** the delete account modal is open
- **AND** `status.email = "user@example.com"`
- **WHEN** the user types exactly `user@example.com`
- **THEN** the Confirm button enables

#### Scenario: Successful deletion
- **GIVEN** the user has typed their email exactly
- **WHEN** they click Confirm
- **THEN** the GUI calls `accountDelete()` (engine auto-passes `--confirm`)
- **AND** on success shows a toast "Account deleted"
- **AND** routes to a signed-out state
- **AND** the user can attempt to sign up again with the same email

#### Scenario: Modal copy
- **GIVEN** the delete account modal is open
- **WHEN** the modal renders
- **THEN** the body text includes "This deletes your account, your subscription, and all backed-up data. This cannot be undone."
