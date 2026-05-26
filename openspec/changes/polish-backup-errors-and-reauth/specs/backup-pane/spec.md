## ADDED Requirements

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

## MODIFIED Requirements

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
