## ADDED Requirements

### Requirement: Auto-backup eligibility

Automatic backup SHALL be considered active only when ALL of the following hold:
`capabilities.features.hostedBackup.supported === true`, `backup status` reports
`signedIn === true`, `status.subscriptionStatus === "active"`, the engine advertises
support for `backup push --if-changed`, and the user has opted in
(`settings.autoBackupEnabled === true`). When any condition is false the GUI SHALL NOT
trigger an automatic push and SHALL NOT show the consent prompt.

#### Scenario: All conditions met
- **GIVEN** hosted backup is supported, the user is signed in with an active subscription, the engine advertises `--if-changed`, and `autoBackupEnabled` is true
- **WHEN** a capture completes successfully
- **THEN** an automatic background push is triggered

#### Scenario: Subscription not active
- **GIVEN** `subscriptionStatus !== "active"`
- **WHEN** a capture completes successfully
- **THEN** no automatic push is triggered
- **AND** the one-time consent prompt is not shown

#### Scenario: Engine lacks --if-changed capability
- **GIVEN** the engine does not advertise support for `backup push --if-changed`
- **WHEN** an otherwise-eligible capture completes
- **THEN** automatic backup stays inactive (no push, no prompt)

#### Scenario: User opted out
- **GIVEN** `settings.autoBackupEnabled === false`
- **WHEN** a capture completes successfully
- **THEN** no automatic push is triggered

### Requirement: One-time consent prompt

The GUI SHALL show a one-time, non-blocking consent prompt with the enable toggle pre-set
ON the first time an automatic backup would fire for an eligible user who has not yet been
asked (`settings.autoBackupPromptSeen === false`). The GUI SHALL persist the user's
decision to `settings.autoBackupEnabled` and set `settings.autoBackupPromptSeen` so the
prompt is never shown again.

#### Scenario: First eligible capture shows the prompt
- **GIVEN** the user is eligible and `autoBackupPromptSeen === false`
- **WHEN** the first capture completes successfully
- **THEN** a one-time non-blocking consent prompt appears with the toggle pre-set ON

#### Scenario: Prompt shown at most once
- **GIVEN** `autoBackupPromptSeen === true`
- **WHEN** a subsequent capture completes
- **THEN** the consent prompt is not shown again

#### Scenario: Declining turns auto-backup off
- **GIVEN** the consent prompt is shown
- **WHEN** the user switches the toggle off and dismisses it
- **THEN** `autoBackupEnabled` is set to false
- **AND** `autoBackupPromptSeen` is set to true
- **AND** no automatic push is triggered

### Requirement: Automatic backup on capture

A successful capture (and only a capture) SHALL trigger a background hosted-backup push of
the captured profile when auto-backup is active. The push SHALL run without the full
`PushProgressDialog`; a subtle inline status indicator SHALL be shown in the
capture-complete summary instead. A successful apply SHALL NOT trigger an automatic backup.

#### Scenario: Capture success triggers a background push
- **GIVEN** auto-backup is active
- **WHEN** a capture completes successfully
- **THEN** a background `backup push --if-changed` is invoked for the captured profile
- **AND** no full progress modal is opened

#### Scenario: Apply does not trigger auto-backup
- **GIVEN** auto-backup is active
- **WHEN** an apply completes successfully
- **THEN** no automatic push is triggered

#### Scenario: Inline status during background push
- **WHEN** a background auto-push is in flight
- **THEN** the capture-complete summary shows a subtle "Backing up…" indicator
- **AND** on success it shows "Backed up" without opening a dialog

### Requirement: Content-hash dedup via engine --if-changed

Automatic pushes SHALL pass `--if-changed` so the engine no-ops when the candidate manifest
equals the latest version's `manifestSha256`. A `skipped`/`unchanged` result SHALL be
treated as success with no UI noise and SHALL NOT create a new version. An `uploaded` result
SHALL update the backup status and record the returned backup identifier.

#### Scenario: Unchanged profile is skipped
- **GIVEN** the captured profile is byte-equivalent to the latest backed-up version
- **WHEN** the background `backup push --if-changed` runs
- **THEN** the engine returns a `skipped`/`unchanged` result
- **AND** no new version is created
- **AND** no error, toast, or dialog is surfaced

#### Scenario: Changed profile is uploaded
- **GIVEN** the captured profile differs from the latest backed-up version
- **WHEN** the background push runs
- **THEN** a new version is uploaded
- **AND** the backup status reflects the new last-backed-up time

### Requirement: Profile-to-backup association

The GUI SHALL maintain a persistent mapping from a profile key to its backup identifier
(`settings.profileBackupIds`) so that automatic pushes of the same profile update the same
backup rather than creating a new backup each time. The first automatic push for a profile
key SHALL omit `--backup-id` (passing `--name`) and SHALL store the backup identifier
returned by the engine; subsequent pushes SHALL pass the stored `--backup-id`.

#### Scenario: First auto-push creates and records the backup
- **GIVEN** a profile key with no entry in `profileBackupIds`
- **WHEN** its first automatic push succeeds
- **THEN** the push omits `--backup-id` and passes `--name`
- **AND** the returned backup identifier is stored against the profile key

#### Scenario: Subsequent auto-push targets the stored backup
- **GIVEN** a profile key already mapped to a backup identifier
- **WHEN** a later automatic push runs
- **THEN** it passes the stored `--backup-id`

### Requirement: Background auth-failure handling

When a background automatic push returns `AUTH_REQUIRED`, the GUI SHALL NOT open a modal.
It SHALL silently skip the push, flip the last-sync indicator to a persistent, actionable
"Sign in to resume backups" state, and show a one-time toast on the first auth failure of
the session. It SHALL retry automatically on the next capture or window focus, and SHALL
resume normal operation once the session is restored.

#### Scenario: Auth-required does not open a modal
- **GIVEN** auto-backup is active and the session has expired beyond refresh
- **WHEN** a background push returns `AUTH_REQUIRED`
- **THEN** no modal or dialog is opened automatically
- **AND** the last-sync indicator shows a persistent "Sign in to resume backups" affordance

#### Scenario: First auth failure shows a one-time toast
- **GIVEN** the first background auth failure of the session occurs
- **WHEN** the GUI handles it
- **THEN** a single non-blocking toast is shown

#### Scenario: Subsequent auth failures are not re-toasted
- **GIVEN** a background auth failure already toasted this session
- **WHEN** another background push returns `AUTH_REQUIRED`
- **THEN** no additional toast is shown
- **AND** the persistent indicator remains

#### Scenario: Resumes after re-auth
- **GIVEN** auto-backup was paused due to an auth failure
- **WHEN** the user signs in again and a later capture completes
- **THEN** the automatic push runs normally
- **AND** the "Sign in to resume backups" affordance clears

### Requirement: Background non-auth error handling

The GUI SHALL handle non-auth failures of a background automatic push by error class:
transient/unreachable errors SHALL be silently skipped and retried on the next trigger,
while `STORAGE_QUOTA_EXCEEDED` SHALL surface a persistent friendly quota notice. All
surfaced copy SHALL be produced via `friendlyBackupError()`; raw engine
`message`/`remediation` and CLI jargon SHALL NOT be displayed.

#### Scenario: Transient error is silent
- **GIVEN** a background push fails with `BACKEND_UNREACHABLE`
- **WHEN** the GUI handles it
- **THEN** no toast or inline error is surfaced
- **AND** the push is retried on the next trigger

#### Scenario: Quota exceeded is surfaced
- **GIVEN** a background push fails with `STORAGE_QUOTA_EXCEEDED`
- **WHEN** the GUI handles it
- **THEN** a persistent friendly quota notice is shown
- **AND** no raw engine code or CLI command is displayed

### Requirement: Settings opt-out

The Settings surface SHALL expose a reversible `autoBackupEnabled` toggle. Turning it off
SHALL stop all automatic pushes; turning it back on SHALL re-enable them without re-showing
the one-time consent prompt.

#### Scenario: Toggle off disables auto-backup
- **GIVEN** auto-backup is enabled
- **WHEN** the user turns off the Settings toggle
- **THEN** subsequent captures trigger no automatic push

#### Scenario: Toggle on re-enables without re-prompting
- **GIVEN** `autoBackupPromptSeen === true` and the toggle is off
- **WHEN** the user turns the Settings toggle on
- **THEN** automatic backup resumes
- **AND** the one-time consent prompt is not shown again
