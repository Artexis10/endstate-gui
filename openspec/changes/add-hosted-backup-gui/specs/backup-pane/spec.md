## ADDED Requirements

### Requirement: Backup pane visibility

The backup pane SHALL render only when `capabilities.features.hostedBackup.supported === true` AND `backup status` reports `signedIn === true`.

#### Scenario: Signed-in user sees backup pane entry
- **GIVEN** hosted backup is supported by the bundled engine
- **AND** the user is signed in
- **WHEN** the app renders
- **THEN** a Backup entry point is available in the navigation
- **AND** clicking it routes to the backup pane

### Requirement: Subscription banner

The backup pane SHALL render a subscription-state banner reflecting `status.subscriptionStatus`. The banner colour and copy SHALL match the four documented states (`active`, `grace`, `cancelled`, `none`) per contract §10.

#### Scenario: Active subscription
- **GIVEN** `status.subscriptionStatus === "active"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Hosted Backup active" in success colour

#### Scenario: Grace state
- **GIVEN** `status.subscriptionStatus === "grace"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Payment failed — fix billing within 30 days to keep backups" in warn colour
- **AND** a Manage subscription link points at `https://substratesystems.io/account`

#### Scenario: Cancelled state
- **GIVEN** `status.subscriptionStatus === "cancelled"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Subscription cancelled — backups read-only, purged in N days" in error colour

#### Scenario: None state
- **GIVEN** `status.subscriptionStatus === "none"` or undefined
- **WHEN** the backup pane renders
- **THEN** the banner reads "Subscribe to enable hosted backup" with a Subscribe button
- **AND** the Subscribe button opens `https://substratesystems.io/#pricing` via the OS shell

### Requirement: Subscription gating of write actions

Push and Restore SHALL be disabled when `subscriptionStatus !== "active"`. Delete actions SHALL be allowed in any state except `none` (per contract §10 kindness exception).

#### Scenario: Push disabled in grace
- **GIVEN** `subscriptionStatus === "grace"`
- **WHEN** the backup pane renders a backup row
- **THEN** the "Push new version" button is disabled
- **AND** the "Restore" button remains enabled
- **AND** the per-version "Delete this version" action remains enabled

#### Scenario: Delete allowed in cancelled
- **GIVEN** `subscriptionStatus === "cancelled"`
- **WHEN** the user clicks "Delete backup"
- **THEN** the delete confirmation modal opens
- **AND** confirming calls `backupDelete(backupId)` successfully

### Requirement: Backup list and version list

The backup pane SHALL render the list of backups returned by `endstate backup list` and, on selection, the versions returned by `endstate backup versions --backup-id <id>`.

#### Scenario: Backup list renders
- **GIVEN** `backupList` returns one or more backups
- **WHEN** the pane renders
- **THEN** each backup shows name, total size, last-version date, and version count

#### Scenario: Per-version actions
- **WHEN** a version row's action menu is opened
- **THEN** "Restore this version" and "Delete this version" are available
- **AND** "Restore this version" opens a destination picker followed by a `pull-progress-dialog`
- **AND** "Delete this version" opens the delete confirmation modal

### Requirement: Push action with streaming progress

The Push action SHALL invoke `endstate backup push --profile <p> --backup-id <id> --events jsonl`, render `backup-chunk` events as a progress dialog, and surface success/error per the engine envelope.

#### Scenario: Push happy path
- **GIVEN** the user clicks "Push new version" with a profile selected
- **WHEN** the engine emits `backup-chunk` events with status `uploading` then `uploaded`
- **THEN** the progress dialog updates the chunk-progress count in real time
- **AND** on `success: true` envelope, a toast "Backup uploaded" appears
- **AND** the version list refreshes to include the new `versionId`

#### Scenario: Push cancellation
- **GIVEN** a push is in progress
- **WHEN** the user clicks Cancel
- **THEN** the GUI invokes `engine_cancel`
- **AND** shows a calm toast "Push cancelled. Partial upload will be cleared automatically."
- **AND** does not call any substrate cancel API

#### Scenario: Quota exceeded error
- **GIVEN** the engine returns `error.code === "STORAGE_QUOTA_EXCEEDED"`
- **WHEN** the push completes
- **THEN** the GUI shows a modal with the engine's `message` and `remediation`

### Requirement: Pull / restore action with streaming progress

The Pull action SHALL invoke `endstate backup pull --backup-id <id> --version-id <id> --to <path> --events jsonl` and render the three-substep progress (downloading → verified → decrypted).

#### Scenario: Pull renders three sub-phases
- **GIVEN** the user starts a restore
- **WHEN** chunk events arrive with statuses `downloading`, `verified`, `decrypted`
- **THEN** the progress dialog reflects each sub-phase per chunk

#### Scenario: Pull success
- **GIVEN** the engine returns `data.writtenTo`
- **WHEN** the dialog closes
- **THEN** a toast displays the destination path
- **AND** offers an "Open folder" action that opens `writtenTo`

### Requirement: Restore-on-new-machine wizard

When a user signs in and has remote backups but zero local profiles in their profiles directory, the GUI SHALL offer a restore wizard before routing to the backup pane.

#### Scenario: Wizard triggers on fresh machine
- **GIVEN** the user just signed in
- **AND** `backupList` returns at least one backup
- **AND** the local profiles directory contains zero `.profile.json` files
- **WHEN** the post-sign-in routing decides
- **THEN** the restore wizard opens

#### Scenario: Wizard skipped when local profiles exist
- **GIVEN** the user just signed in
- **AND** the local profiles directory contains one or more profiles
- **WHEN** the post-sign-in routing decides
- **THEN** the wizard is not shown
- **AND** the user lands on the backup pane

#### Scenario: Wizard success summary
- **GIVEN** the wizard completes a restore
- **WHEN** the success step renders
- **THEN** it shows the destination path
- **AND** offers an "Open the restored folder" button

### Requirement: Delete confirmation

Delete actions (backup or version) SHALL require an explicit confirmation in a modal before invoking the engine.

#### Scenario: Delete backup confirmation
- **GIVEN** the user clicks "Delete backup"
- **WHEN** the confirmation modal opens
- **THEN** it shows the backup name and warns "This cannot be undone"
- **AND** Confirm invokes `backupDelete(backupId)` (engine auto-passes `--confirm`)
- **AND** Cancel closes the modal without engine call
