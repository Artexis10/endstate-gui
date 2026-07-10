# Continuous Protection UI

GUI surface for the engine's scheduled drift check (`endstate schedule` family): a capability-gated Settings card that registers/removes the daily check, persisted preferences with launch-time self-heal, and a drift chip on the landing screen driven exclusively by engine-reported status. The GUI performs no drift computation of its own (CLI is source of truth).

## ADDED Requirements

### Requirement: Feature is dark without the engine capability
The GUI SHALL render no Continuous Protection surface (no Settings card, no drift chip, no schedule commands issued) unless the engine capabilities advertise `features.schedule.supported === true`.

#### Scenario: Bundled engine predates the schedule feature
- **GIVEN** a capabilities envelope without `features.schedule` (engine ≤ 2.21)
- **WHEN** the app boots
- **THEN** the Settings page shows no "Continuous protection" card
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
The card SHALL offer "Back up automatically when changes are found" only when the engine advertises `features.schedule.autoPush` AND the existing auto-backup availability conditions hold (hosted backup supported, `--if-changed` advertised, signed in, active subscription). When enabled it SHALL pass `--auto-push` to `schedule enable`.

#### Scenario: Auto-push unavailable
- **WHEN** either `features.schedule.autoPush` is absent/false or auto-backup conditions do not hold
- **THEN** the sub-toggle is not rendered

### Requirement: Launch wiring fetches status and self-heals
After a successful capabilities handshake with `features.schedule.supported`, the GUI SHALL fetch `schedule status` and store it as the drift source. When the persisted preference `scheduleEnabled` is true and a manifest reference exists, the GUI SHALL re-assert `schedule enable` (idempotent on the engine side) to self-heal a lost task, then refresh status. Status or self-heal failures SHALL NOT block boot.

#### Scenario: Self-heal on boot
- **GIVEN** `scheduleEnabled: true` persisted and a known manifest (engine config or saved capture)
- **WHEN** the app boots against a schedule-capable engine
- **THEN** `schedule enable` is re-asserted with the persisted time and auto-push preference
- **AND** `schedule status` is re-fetched afterwards

### Requirement: Drift chip renders engine status only
The landing screen's "Save this computer" card SHALL render at most one chip derived purely from `schedule status`: never-run and clean states render nothing; drift renders an amber "N apps drifted since your snapshot" chip (pluralised, count = `verify.summary.fail`); a hard last-run error renders a muted "Drift check failing" chip. Drift SHALL take precedence over the failing chip and over the session "Scan complete" chip. A disabled schedule SHALL render nothing even when a stale last-run is retained.

#### Scenario: Never run
- **WHEN** `schedule status` reports `lastRun: null`
- **THEN** no drift chip is shown

#### Scenario: Clean run
- **WHEN** the last run reports `verify.summary.fail === 0` and no error
- **THEN** no drift chip is shown

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
