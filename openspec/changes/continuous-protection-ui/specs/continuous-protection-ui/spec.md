# Scheduled Setup Checks UI

GUI surface for the engine's scheduled drift check (`endstate schedule` family): a capability-gated Settings card that registers/removes the daily check, persisted preferences with launch-time self-heal, and a drift chip on the landing screen driven exclusively by engine-reported status. The GUI performs no drift computation of its own (CLI is source of truth).

## ADDED Requirements

### Requirement: Feature is dark without the engine capability
The GUI SHALL render no Scheduled setup checks surface (no Settings card, no drift chip, no schedule commands issued) unless the engine capabilities advertise `features.schedule.supported === true`.

#### Scenario: Bundled engine predates the schedule feature
- **GIVEN** a capabilities envelope without `features.schedule` (engine ≤ 2.21)
- **WHEN** the app boots
- **THEN** the Settings page shows no "Scheduled setup checks" card
- **AND** no `schedule` subcommand is ever invoked
- **AND** the landing screen shows no drift chip

#### Scenario: Capability probe defaults safe
- **WHEN** capabilities are null, missing `features`, or `features.schedule.supported` is false
- **THEN** `engineSupportsSchedule` returns false

### Requirement: Enable toggle is the consent and requires a saved capture
The Settings card SHALL provide a toggle "Check this computer for drift daily" plus a time-of-day input defaulting to 09:00. Toggling on SHALL invoke `schedule enable --manifest <saved capture> --time <HH:MM>` with no additional confirmation dialog; toggling off SHALL invoke `schedule disable`. Enabling SHALL require a saved capture as the baseline manifest; without one the toggle SHALL be disabled with the hint "Save this computer first".

#### Scenario: No saved capture yet
- **GIVEN** `scheduleManifestPath` is unset
- **WHEN** the Settings card renders
- **THEN** the enable toggle is disabled and the hint "Save this computer first" is shown

#### Scenario: Enable after saving a capture
- **GIVEN** the user saved a capture to file
- **WHEN** the user turns the toggle on
- **THEN** the GUI calls `schedule enable` with that file as `--manifest` and the configured `--time`
- **AND** persists `scheduleEnabled: true` only after the engine call succeeds

#### Scenario: Disabling always possible
- **GIVEN** the schedule is enabled but the saved capture reference is missing
- **WHEN** the Settings card renders
- **THEN** the toggle can still be turned off

### Requirement: Auto-push sub-toggle is doubly gated
The card SHALL offer "Upload the saved setup to Endstate Cloud" only when the engine advertises `features.schedule.autoPush` AND the existing auto-backup availability conditions hold (hosted backup supported, `--if-changed` advertised, signed in, active subscription). When enabled it SHALL pass `--auto-push` to `schedule enable`.

#### Scenario: Auto-push unavailable
- **WHEN** either `features.schedule.autoPush` is absent/false or auto-backup conditions do not hold
- **THEN** the sub-toggle is not rendered

### Requirement: Launch wiring fetches status and self-heals
After a successful capabilities handshake with `features.schedule.supported`, the GUI SHALL fetch `schedule status` and store it as the drift source. When the persisted preference `scheduleEnabled` is true and a manifest reference exists, including a current-engine `.endstate` or legacy `.zip` bundle, the GUI SHALL re-assert `schedule enable` (idempotent on the engine side) to self-heal a lost task, then refresh status. Older, slower status responses SHALL NOT overwrite a newer response. Status or self-heal failures SHALL NOT block boot.

#### Scenario: Self-heal on boot
- **GIVEN** `scheduleEnabled: true` persisted and a known manifest (engine config or saved capture)
- **WHEN** the app boots against a schedule-capable engine
- **THEN** `schedule enable` is re-asserted with the persisted time and auto-push preference
- **AND** `schedule status` is re-fetched afterwards

#### Scenario: Self-heal accepts a bundle baseline
- **GIVEN** `scheduleEnabled: true` persisted and a manifest reference ending in `.endstate` or `.zip`
- **WHEN** the app boots against an engine advertising `features.schedule.bundleManifestSupported: true`
- **THEN** `schedule enable` is re-asserted with that bundle path

### Requirement: A saved bundle is a drift baseline
The GUI SHALL record the saved `.endstate` or legacy `.zip` bundle path directly as `scheduleManifestPath` and MAY pass it to `schedule enable --manifest` only when the current engine advertises `features.schedule.bundleManifestSupported: true`. A schedule-capable engine without that additive capability SHALL not be re-armed with a bundle path. Web/browser-download saves SHALL NOT update the baseline (no stable on-disk path).

#### Scenario: Manifest-only save is its own baseline
- **GIVEN** a capture saved to file as `.jsonc`
- **WHEN** the save completes against an engine advertising `features.schedule.bundleManifestSupported: true`
- **THEN** `scheduleManifestPath` records the saved path unchanged

#### Scenario: Bundle save records the bundle itself
- **GIVEN** a capture saved to file as `C:\snap.zip`
- **WHEN** the save completes
- **THEN** `scheduleManifestPath` records `C:\snap.zip`
- **AND** an active schedule is re-pointed at that bundle

### Requirement: Cloud schedules pin a known backup target

When the engine advertises `capabilities.data.commands.schedule.flags` containing `--backup-id`, the GUI SHALL pass `schedule enable --backup-id <id>` only when `profileBackupIds` contains an ID for the scheduled manifest path, or when re-asserting the engine's already-persisted `status.backupId`. The GUI SHALL NOT choose an ID from another profile mapping. Engines without the additive flag SHALL receive no `--backup-id` argument.

#### Scenario: Multiple mappings do not cause a guessed target
- **GIVEN** a scheduled manifest without a matching `profileBackupIds` entry and other profile mappings exist
- **WHEN** the schedule is enabled
- **THEN** the GUI omits `--backup-id`

### Requirement: Legacy ambiguous uploads require explicit discard confirmation

When `pendingUpload.lastOutcome` is `upload_uncertain` and `artifactSha256` is present, the GUI SHALL offer an explicit confirmation control that invokes exactly `schedule discard-upload --artifact-sha256 <sha> --confirm`. The copy SHALL state that the managed service may already have accepted the version, automatic retry is paused to avoid duplicates, and the local capture/baseline is retained. The control SHALL NOT render for retryable upload states, or without an artifact hash.

#### Scenario: Discard requires explicit confirmation
- **GIVEN** `upload_uncertain` with an `artifactSha256`
- **WHEN** the user opens the discard control but cancels confirmation
- **THEN** no discard command is invoked

### Requirement: Scheduled status chip renders engine truth only
The landing screen's "Save this computer" card SHALL render at most one chip derived purely from `schedule status`. Additive `lastRun.status: "running"` SHALL render the calm non-green `Setup check in progress` state before all prior drift and upload truth, so a crashed or in-progress run cannot leave a previous healthy result visible. `completed` SHALL continue through normal drift/upload mapping; `failed` SHALL render `Drift check failing` even if error details are absent. An unknown non-empty status SHALL use the same fail-closed in-progress state; absent status remains compatible with older engines. Drift renders an amber "N apps drifted since your snapshot" chip (pluralised, count = `verify.summary.fail`); a hard last-run error renders a muted "Drift check failing" chip. When `pendingUpload` is present, `pending: true` renders `Upload pending`, `lastOutcome: "auth_required"` renders `Sign in required to upload`, `lastOutcome: "subscription_required"` renders an actionable subscription restriction, `lastOutcome: "setup_required"` tells a managed active user to open Endstate Cloud and save the first Cloud version (with neutral provider wording elsewhere), `lastOutcome: "upload_uncertain"` says the service may have accepted the version and automatic retry is paused to avoid duplicates, `lastOutcome: "error"` renders `Upload failed`, and `lastOutcome: "offline"` renders `Offline — local version saved; Cloud upload will retry`. `setup_required` and `upload_uncertain` SHALL take precedence over a retained verify drift count because they describe the terminal result of the capture triggered by that drift. If `pendingUpload` is absent (an older engine), the card renders `Saved locally only`; unknown upload state SHALL NOT be represented as healthy or current. Drift SHALL otherwise take precedence over the failing chip and over the session "Scan complete" chip. A disabled schedule SHALL render nothing even when a stale last-run is retained.

#### Scenario: Never run
- **WHEN** `schedule status` reports `lastRun: null`
- **THEN** no drift chip is shown

#### Scenario: Clean run
- **WHEN** the last run reports `verify.summary.fail === 0`, no error, and `pendingUpload.pending === false` with a successful/skipped outcome
- **THEN** no drift chip is shown

#### Scenario: Older engine has no upload truth
- **WHEN** an enabled schedule status has a last run but omits `pendingUpload`
- **THEN** the card reads "Saved locally only"
- **AND** it does not call the setup current or healthy

#### Scenario: Pending upload requires attention
- **WHEN** `pendingUpload.pending === true`
- **THEN** the card reads "Upload pending"
- **AND** `auth_required`, `setup_required`, `upload_uncertain`, and `error` outcomes render their distinct, actionable states rather than generic `Upload pending`

#### Scenario: Drift found
- **WHEN** the last run reports `verify.summary.fail === 3`
- **THEN** an amber chip reads "3 apps drifted since your snapshot"

#### Scenario: Last run failed
- **WHEN** the last run carries a `lastRun.error`
- **THEN** a muted chip reads "Drift check failing"

### Requirement: Preferences persist like other settings
The GUI SHALL persist `scheduleEnabled` (default false), `scheduleTime` (default "09:00"), `scheduleAutoPush` (default false), and `scheduleManifestPath` (default null) in the app settings store, defaulting safely for settings blobs written by older builds.

#### Scenario: Older settings blob
- **WHEN** a stored settings blob predates these fields
- **THEN** loading yields the defaults (off, 09:00, off, null)
