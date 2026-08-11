## MODIFIED Requirements

### Requirement: Sign-in pane visibility gate

The GUI SHALL render the auth pane when `capabilities.features.hostedBackup.supported === true` AND `backup status` reports `signedIn === false`. When hosted backup is unsupported by the bundled engine, the auth pane SHALL NOT render anywhere in the app. The capability key remains `hostedBackup`; only the copy shown to the user names the service Endstate Cloud.

#### Scenario: Signed-out user on supported engine
- **GIVEN** the bundled engine reports `features.hostedBackup.supported = true`
- **AND** `backup status` returns `signedIn = false`
- **WHEN** the app boots
- **THEN** the auth pane is shown as the active page
- **AND** non-hosted-backup flows (Capture, Setup, Verify) remain available via the overview screen

#### Scenario: Engine without hosted-backup support
- **GIVEN** the bundled engine reports no `features.hostedBackup` field or `supported = false`
- **WHEN** the app boots
- **THEN** the auth pane is not reachable
- **AND** a neutral banner reads "Endstate Cloud is not available with the bundled engine. Update Endstate to enable it."
- **AND** local provisioning flows continue to work
