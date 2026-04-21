# in-app-update Specification

## Purpose
TBD - created by archiving change add-in-app-updater-gui. Update Purpose after archive.
## Requirements
### Requirement: Automatic update check on app launch

The GUI SHALL check for updates exactly once per app launch when running in the Tauri desktop runtime. The check SHALL occur after the license gate has passed. The check SHALL be non-blocking and SHALL NOT delay any other startup work.

#### Scenario: Tauri launch with an available update

- **WHEN** the app starts in the Tauri desktop runtime and an update is available from the configured endpoint
- **THEN** a non-modal toast SHALL appear announcing the new version
- **AND** the toast SHALL include a primary action labelled "Install and restart"
- **AND** the toast SHALL include a secondary action labelled "Later"

#### Scenario: Tauri launch with no available update

- **WHEN** the app starts in the Tauri desktop runtime and no update is available
- **THEN** no toast SHALL be shown to the user
- **AND** no error SHALL be surfaced

#### Scenario: Launch outside the Tauri runtime

- **WHEN** the app starts in a non-Tauri environment (web preview, Playwright E2E, or any context where `isTauriRuntime()` returns false)
- **THEN** no update check SHALL run
- **AND** no Tauri-only plugin module SHALL be evaluated at module-load time

#### Scenario: Re-render within the same session

- **WHEN** the `UpdatePrompt` component re-renders or remounts within a single app launch
- **THEN** the automatic check SHALL NOT run a second time

### Requirement: Manual update check from Settings

The Settings page SHALL expose a "Check for updates" action that triggers the same update-check logic as the automatic launch check, but with user-visible feedback for every possible outcome.

#### Scenario: Manual check with update available

- **WHEN** the user clicks "Check for updates" in Settings and an update is available
- **THEN** a "Checking for updates…" progress toast SHALL be shown during the check
- **AND** on completion the update prompt toast SHALL be shown with "Install and restart" and "Later" actions

#### Scenario: Manual check with no update available

- **WHEN** the user clicks "Check for updates" in Settings and the app is already on the latest version
- **THEN** a confirmation toast reading "Endstate is up to date" SHALL be shown

#### Scenario: Manual check with network or endpoint failure

- **WHEN** the user clicks "Check for updates" and the request to the update endpoint fails for any reason (network, HTTP error, malformed manifest, signature verification failure)
- **THEN** an error toast SHALL be shown including a human-readable failure description

#### Scenario: Manual check outside the Tauri runtime

- **WHEN** the Settings page is rendered in a non-Tauri environment
- **THEN** the "Check for updates" button SHALL be disabled
- **AND** helper text SHALL indicate that updates are only available in the desktop app

### Requirement: Install and restart flow

When the user accepts an update, the app SHALL download the signed bundle, verify its signature, install it, and restart in a single user gesture. Progress SHALL be visible throughout.

#### Scenario: Successful install

- **WHEN** the user clicks "Install and restart" on an update prompt
- **THEN** a persistent progress toast SHALL be shown during download
- **AND** the toast SHALL update to show the number of bytes downloaded and, when known, the total bundle size
- **AND** once the download completes and the bundle passes signature verification, the app SHALL be relaunched on the new version
- **AND** the progress toast SHALL be dismissed before the relaunch

#### Scenario: Install failure

- **WHEN** the user clicks "Install and restart" and the download, verification, or install step fails
- **THEN** the progress toast SHALL be dismissed
- **AND** an error toast SHALL be shown including a human-readable failure description
- **AND** the app SHALL continue running on the currently installed version

### Requirement: Deferred update handling

When the user defers an available update, the app SHALL respect that choice for the current session without scheduling any re-prompt.

#### Scenario: User clicks "Later"

- **WHEN** the user clicks "Later" on an update prompt
- **THEN** the toast SHALL be dismissed
- **AND** no additional update prompt SHALL be shown for the same update during the current app launch

#### Scenario: Next launch re-check

- **WHEN** the app is relaunched after the user previously dismissed an update with "Later"
- **THEN** the automatic check SHALL run again and SHALL re-prompt if the update is still available

### Requirement: Silent failure for automatic checks

The automatic update check SHALL never surface errors to the user. All failures (network, HTTP error, malformed manifest, signature verification failure, missing plugin) SHALL be logged to the browser console only.

#### Scenario: Network failure during auto-check

- **WHEN** the automatic check fails to reach the update endpoint
- **THEN** no toast SHALL be shown
- **AND** a diagnostic message SHALL be logged to the console

#### Scenario: Signature verification failure during auto-check

- **WHEN** the automatic check retrieves a manifest whose signature does not verify against the pubkey configured in `tauri.conf.json`
- **THEN** no toast SHALL be shown
- **AND** the update SHALL NOT be installed

#### Scenario: Placeholder pubkey in effect

- **WHEN** the shipped `tauri.conf.json` contains the literal placeholder value `REPLACE_WITH_ACTUAL_PUBLIC_KEY`
- **THEN** every signature verification SHALL fail and be treated as a silent auto-check failure
- **AND** no update SHALL ever install until a real pubkey is in place

### Requirement: Updater configuration surface

The updater endpoint, public key, and dialog preference SHALL live in `src-tauri/tauri.conf.json` under `plugins.updater`. The GUI codebase SHALL NOT hardcode these values anywhere else.

#### Scenario: Endpoint is configurable via config file

- **WHEN** the `plugins.updater.endpoints` array is changed in `tauri.conf.json`
- **THEN** the next app build SHALL check the new endpoint without any code changes

#### Scenario: Tauri's built-in dialog is disabled

- **WHEN** `tauri.conf.json` is loaded
- **THEN** `plugins.updater.dialog` SHALL be `false`
- **AND** all user-facing update UX SHALL come from the app's React components, not from Tauri's built-in dialog

### Requirement: Capability permissions

The app's default capability SHALL grant the minimum permissions needed to check for, download, install, and relaunch for an update, and no more.

#### Scenario: Required permissions present

- **WHEN** `src-tauri/capabilities/default.json` is loaded for the `main` window
- **THEN** the permissions list SHALL include `updater:default` (check + download + install)
- **AND** it SHALL include `process:allow-restart` (relaunch the app after install)

### Requirement: Operational runbook

The repository SHALL include an operator-facing runbook describing every manual step required to make updates actually work end-to-end, including keypair generation, secret custody, and key rotation.

#### Scenario: Runbook is present and discoverable

- **WHEN** an operator needs to set up signing for the first time
- **THEN** the file `docs/runbooks/UPDATER_SETUP.md` SHALL document: the command to generate an ed25519 keypair, the GitHub Actions secret names to store the private key and its password under, the step to paste the public key into `tauri.conf.json`, a verification procedure, and a key-rotation procedure

