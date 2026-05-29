# backup-pane Specification

## Purpose

Defines the Backup pane: the primary signed-in surface for Hosted Backup. Covers visibility, subscription banner states, subscription checkout via engine command, gating of write actions, backup/version listing, push/pull/delete with streaming progress, the restore-on-new-machine wizard, and delete confirmations. The pane is gated on engine support for hosted backup and the user being signed in. All subscription and backup mutations flow through the engine (engine-as-source-of-truth).
## Requirements
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
- **AND** a Manage subscription button is available — clicking it invokes `endstate backup browser-session`, composes `${accountUrl}?session=${sessionToken}`, and opens the resulting URL via the OS shell (substrate's `/account/start` route swaps the JWT for a session cookie and 302s to the cookie-only `/account` page; see hosted-backup contract §5)
- **AND** while the engine round-trip is in flight the button is disabled and reads "Opening…" — a fast double-click is also blocked by a ref-mirror so the second click never reaches the engine

#### Scenario: Grace state
- **GIVEN** `status.subscriptionStatus === "grace"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Payment failed — fix billing within 30 days to keep backups" in warn colour
- **AND** the Manage subscription button uses the same `backup browser-session` handoff as the active state

#### Scenario: Cancelled state
- **GIVEN** `status.subscriptionStatus === "cancelled"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Subscription cancelled — backups read-only, purged in N days" in error colour
- **AND** a Renew subscription button begins checkout (see "Subscription checkout via engine command")

#### Scenario: None state
- **GIVEN** `status.subscriptionStatus === "none"` or undefined
- **WHEN** the backup pane renders
- **THEN** the banner reads "Subscribe to enable hosted backup" with a Subscribe button
- **AND** the Subscribe button begins checkout (see "Subscription checkout via engine command")

#### Scenario: Manage handoff AUTH_REQUIRED
- **GIVEN** the user is signed in but the engine reports `AUTH_REQUIRED` from the `backup browser-session` call (e.g. session expired between status fetch and click)
- **WHEN** the click handler catches the error
- **THEN** it does NOT call `openExternal`
- **AND** it invokes `onAuthLost`, which routes to the inline re-auth dialog without unmounting the pane (preserves Wave 6 D3 behaviour)

#### Scenario: Manage handoff backend failure
- **GIVEN** the engine returns a non-AUTH_REQUIRED error from `backup browser-session` (BACKEND_UNREACHABLE, SUBSCRIPTION_REQUIRED, etc.)
- **WHEN** the click handler catches the error
- **THEN** it shows a friendly toast via `friendlyBackupError` — no raw CLI jargon
- **AND** no URL is opened

### Requirement: Subscription checkout via engine command

Subscribe (`none`) and Renew (`cancelled`) SHALL begin checkout by invoking `endstate backup subscribe` and opening the returned `checkoutUrl` in the system browser. The GUI SHALL NOT render the Paddle overlay in-app — substrate's `/endstate` landing handles the `_ptxn` param (hosted-backup contract §7). The GUI never calls substrate directly; the engine owns the authenticated checkout call (engine-as-source-of-truth). Requires engine ≥ v2.1.0.

#### Scenario: Subscribe opens the minted checkout URL
- **GIVEN** `status.subscriptionStatus === "none"`
- **WHEN** the user clicks Subscribe
- **THEN** `backup subscribe` is invoked
- **AND** on success the returned `checkoutUrl` is opened via the OS shell

#### Scenario: Session lost during checkout
- **GIVEN** the engine returns `AUTH_REQUIRED` from `backup subscribe`
- **WHEN** the user clicks Subscribe
- **THEN** no error toast is shown
- **AND** the pane's `onAuthLost` handler opens the re-auth dialog (per "Session re-auth preserves pane state")
- **AND** the pane state behind the dialog is preserved

#### Scenario: Double-mint guard
- **GIVEN** a checkout request is in flight
- **WHEN** the banner re-renders
- **THEN** the Subscribe/Renew button is disabled until the request settles

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

The Push action SHALL invoke `endstate backup push --profile <p> --backup-id <id> --events jsonl`, render `backup-chunk` events as a progress dialog, and surface success/error per the engine envelope. Error envelopes SHALL be rendered via friendly engine-error mapping (per "Friendly engine-error rendering"); raw engine `message` / `remediation` SHALL NOT be displayed.

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
- **THEN** the GUI renders a friendly headline and body via `friendlyBackupError()`
- **AND** the engine's raw `message` / `remediation` are not surfaced

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

### Requirement: Friendly engine-error rendering

The backup pane and restore wizard SHALL map every engine error to GUI-appropriate copy via a shared `friendlyBackupError()` helper before rendering. The helper SHALL produce a `headline` and optional `body`, `cta`, and `tone`, and SHALL strip CLI-jargon (e.g., `` Run `endstate ...` ``) from the engine's `remediation` field. Raw `error.message` or unfiltered `error.remediation` SHALL NOT be surfaced in any toast, dialog, or inline error.

#### Scenario: Network unreachable error
- **GIVEN** the engine returns `error.code === "BACKEND_UNREACHABLE"`
- **WHEN** the pane renders the error
- **THEN** the headline reads a friendly network-failure message (e.g., "Can't reach hosted backup")
- **AND** a `Retry` CTA invokes the pane's refresh action
- **AND** the engine's raw `error.message` is not visible

#### Scenario: Quota exceeded
- **GIVEN** the engine returns `error.code === "STORAGE_QUOTA_EXCEEDED"`
- **WHEN** the pane renders the error
- **THEN** the headline reads a friendly quota message
- **AND** the tone is `warning` (not destructive)
- **AND** if the engine `remediation` contains backtick-prefixed `endstate` commands, they are not rendered

#### Scenario: Unknown error code fallback
- **GIVEN** the engine returns an unrecognized `error.code`
- **WHEN** the pane renders the error
- **THEN** the helper falls back to the engine's `message` but strips `remediation` if it matches the CLI-jargon pattern

#### Scenario: AUTH_REQUIRED triggers reauth CTA
- **GIVEN** an error with `code === "AUTH_REQUIRED"` reaches the error card
- **WHEN** the user clicks the CTA
- **THEN** the re-auth dialog opens (per "Session re-auth preserves pane state")

### Requirement: Chunk retry visibility

When the engine emits a `backup-chunk` event with `status === "retrying"`, the push and pull progress dialogs SHALL render an amber-toned "Retrying chunk N of M (attempt X of Y)" indicator without decrementing the completed-chunk count. When the optional `attempt` / `maxAttempts` / `current` / `total` fields are absent (e.g., GUI ahead of engine), the dialog SHALL render a fallback "Retrying…" indicator.

#### Scenario: Retry with full fields
- **GIVEN** the engine emits `{ status: "retrying", current: 47, total: 95, attempt: 2, maxAttempts: 3 }`
- **WHEN** the push dialog handles the event
- **THEN** the dialog shows "Retrying chunk 47 of 95 (attempt 2 of 3)" in amber
- **AND** the uploaded-chunk count is unchanged
- **AND** the next non-retry status for the same chunk index clears the retry indicator

#### Scenario: Retry with missing optional fields
- **GIVEN** the engine emits `{ status: "retrying" }` (older engine without retry-event extension)
- **WHEN** the dialog handles the event
- **THEN** the dialog shows a generic "Retrying…" message
- **AND** the uploaded-chunk count is unchanged

#### Scenario: Retry succeeds
- **GIVEN** a `retrying` event was the last status for chunk 47
- **WHEN** the engine emits `{ status: "uploaded", index: 47 }`
- **THEN** the retry indicator clears
- **AND** the uploaded-chunk count increments

### Requirement: Session re-auth preserves pane state

When any backup command returns `error.code === "AUTH_REQUIRED"`, the GUI SHALL open an inline re-auth dialog with the previously-signed-in email pre-filled and locked, while preserving the backup pane's existing state (status banner, backup list, version list, restore wizard step) behind the dialog. The GUI SHALL NOT null out `backupStatusData` or `backupListData` on `AUTH_REQUIRED`. On successful re-auth, the dialog SHALL dismiss and the GUI SHALL refresh status. On dismissal without re-auth, the pane SHALL remain in its prior state.

#### Scenario: AUTH_REQUIRED mid-list
- **GIVEN** the user is viewing the backup list
- **AND** a background refresh returns `AUTH_REQUIRED`
- **WHEN** the GUI handles the auth loss
- **THEN** the re-auth dialog opens with the previous email pre-filled and locked
- **AND** the backup list remains visible behind the dialog

#### Scenario: Re-auth success refreshes status
- **GIVEN** the re-auth dialog is open
- **WHEN** the user enters their passphrase and sign-in succeeds
- **THEN** the dialog dismisses
- **AND** the pane refreshes status
- **AND** the user is left where they were

#### Scenario: Re-auth dismissed without sign-in
- **GIVEN** the re-auth dialog is open
- **WHEN** the user closes it without signing in
- **THEN** the pane state is unchanged
- **AND** subsequent backup operations may surface a fresh `AUTH_REQUIRED` and re-open the dialog

#### Scenario: Different-identity sign-in clears prior list
- **GIVEN** the re-auth dialog opens with `expectedEmail = "alice@example.com"`
- **WHEN** the dialog is configured to allow identity change AND the user signs in as `bob@example.com`
- **THEN** the cached `backupListData` is cleared before the next list fetch
- **AND** the pane does not display Alice's backups labelled as Bob's

#### Scenario: Re-auth dialog suppresses recursive auth loss
- **GIVEN** the re-auth dialog is open
- **AND** a status refresh fires concurrently and returns `AUTH_REQUIRED` again
- **WHEN** the GUI handles the second auth loss
- **THEN** a new dialog instance is NOT opened
- **AND** the existing dialog remains the single point of re-auth

### Requirement: Silent focus refresh

The backup pane SHALL revalidate `backup status` and `backup list` on window-focus / visibilitychange WITHOUT blanking the pane. Cached `status`, `backups`, and any prior `error` SHALL remain visible during the round-trip. On non-AUTH error the cached data SHALL remain unchanged and no error SHALL be surfaced. AUTH_REQUIRED SHALL route through `onAuthLost` only when the re-auth dialog is not already open; if the dialog is open, the silent refresh SHALL drop the event.

#### Scenario: Focus refresh leaves pane painted
- **GIVEN** cached status+list rendered
- **WHEN** window-focus fires and the debounce elapses
- **THEN** no loading spinner is shown at any point
- **AND** the cached data remains visible until the refresh resolves

#### Scenario: Focus refresh non-AUTH failure is silent
- **GIVEN** cached data is rendered
- **WHEN** the silent refresh's `backup status` rejects with BACKEND_UNREACHABLE
- **THEN** no toast, no inline error, cached data unchanged

#### Scenario: Focus refresh AUTH_REQUIRED routes to re-auth when dialog closed
- **GIVEN** cached data is rendered and the re-auth dialog is NOT open
- **WHEN** the silent refresh's `backup status` rejects with AUTH_REQUIRED
- **THEN** `onAuthLost` is invoked
- **AND** the cached backup list, status banner, and quota meter remain visible behind the dialog

#### Scenario: Focus refresh AUTH_REQUIRED is dropped when dialog already open
- **GIVEN** the re-auth dialog is already open from a prior auth loss
- **WHEN** a focus event triggers a silent refresh that also returns AUTH_REQUIRED
- **THEN** `onAuthLost` is NOT invoked again
- **AND** no additional dialog stacking occurs

### Requirement: Quota approaching cap notice

The backup pane SHALL render a persistent warn-tone notice above the quota meter when storage usage is `>=50%` and `<90%`, and a persistent danger-tone notice when usage is `>=90%`. The notice SHALL include the percentage and the byte-formatted used+total values. It SHALL be hidden when `quotaTotalBytes` is unset. The threshold logic SHALL match the QuotaMeter via the shared `quotaTone` utility.

#### Scenario: Warn notice between 50% and 90%
- **GIVEN** `quotaUsedBytes / quotaTotalBytes` is in `[0.5, 0.9)`
- **WHEN** the backup pane renders
- **THEN** a notice with `data-tone="warn"` appears above the QuotaMeter
- **AND** the copy includes the rounded percent and byte-formatted used/total

#### Scenario: Danger notice at or above 90%
- **GIVEN** ratio `>= 0.9`
- **WHEN** the backup pane renders
- **THEN** a notice with `data-tone="danger"` appears
- **AND** the copy includes the percent and a free-space-or-upgrade remediation

#### Scenario: Notice hidden when quota fields absent
- **GIVEN** `quotaTotalBytes` is unset (older engines)
- **WHEN** the backup pane renders
- **THEN** no quota notice is rendered

#### Scenario: Notice is the sole quota signal at 90%
- **GIVEN** ratio crosses to >=0.9
- **THEN** no toast fires (the previous once-per-account toast has been retired)
- **AND** only the persistent danger banner surfaces the signal

### Requirement: Last sync indicator

The backup pane SHALL render a relative-time indicator below the quota meter using `status.lastBackupAt`. The label and freshness band SHALL be produced by the `formatRelativeTime` utility. When `lastBackupAt` is absent or unparseable, the indicator SHALL render "No backups yet" in the calm muted-foreground tint. The indicator SHALL NOT be a live region.

#### Scenario: Recently synced renders fresh tint
- **GIVEN** `lastBackupAt` was within the last 24 hours
- **WHEN** the backup pane renders
- **THEN** the indicator shows a relative-time label in `text-muted-foreground`
- **AND** `data-freshness="fresh"`

#### Scenario: Stale (1–7 days) renders warning tint
- **GIVEN** `lastBackupAt` was 25 hours to 7 days ago
- **WHEN** the backup pane renders
- **THEN** the indicator shows a "N days ago" label in `text-warning/80`
- **AND** `data-freshness="stale"`

#### Scenario: Very-stale renders locale short date
- **GIVEN** `lastBackupAt` was >=7 days ago
- **WHEN** the backup pane renders
- **THEN** the indicator shows a locale-formatted short date in `text-danger/80`
- **AND** `data-freshness="very-stale"`

#### Scenario: Missing lastBackupAt renders "No backups yet"
- **GIVEN** `lastBackupAt` is undefined or unparseable
- **WHEN** the backup pane renders
- **THEN** the indicator shows "No backups yet" in `text-muted-foreground`
- **AND** `data-freshness="never"`

