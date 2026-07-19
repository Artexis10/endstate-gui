# Capture Artifact Flow

## Purpose

Defines capture progress semantics, local profile validation, transactional portable-profile import, explicit Save completion, and layered regression coverage for the Capture-to-Setup boundary.

## Requirements

### Requirement: Capture progress preserves successful meaning

The GUI SHALL render engine capture item statuses `present` with reason `detected`, and compatibility status `captured`, as `DETECTED`. It MUST NOT render either successful capture event as `EXCLUDED`. Final captured app and configuration contents SHALL continue to come from the completed capture envelope.

#### Scenario: Contract capture event is detected
- **WHEN** capture streaming emits an item with status `present` and reason `detected`
- **THEN** the progress row is labeled `DETECTED`

#### Scenario: Engine 2.24.1 compatibility event is detected
- **WHEN** capture streaming emits an item with status `captured`
- **THEN** the progress row is labeled `DETECTED`
- **AND** the event is not treated as skipped or excluded

#### Scenario: A filtered item remains excluded
- **WHEN** capture streaming emits an item with status `skipped` and reason `filtered`, `filtered_runtime`, or `filtered_store`
- **THEN** the progress row is labeled `EXCLUDED`

### Requirement: Version-compatible shared local profile validation

The production Tauri validator and browser-bridge validator SHALL delegate to one shared validator that accepts structurally valid profile manifests with exact integer version 1 or version 2. Fractional, unsupported, and structurally invalid manifests SHALL remain invalid. Focused shared-validator tests SHALL run in pull-request CI.

#### Scenario: Version 1 profile remains valid
- **WHEN** a manifest contains numeric `version: 1` and an apps array
- **THEN** local profile validation reports it valid

#### Scenario: Version 2 capture bundle is valid
- **WHEN** a self-contained capture manifest contains numeric `version: 2`, an apps array, and a nonempty top-level `configCaptures[]` whose provenance and payload records satisfy the engine 2.24.2 structural-isolation contract
- **THEN** local profile validation reports it valid

#### Scenario: Include-dependent version 2 root is rejected at the GUI import boundary
- **WHEN** an imported version 2 root manifest omits top-level `configCaptures[]` and relies on external includes for provenance
- **THEN** local profile validation reports `INVALID_CONFIG_CAPTURE`
- **AND** the GUI does not commit the import, because bare imports cannot preserve an external include graph and capture ZIPs are required to be self-contained

#### Scenario: Generation and legacy lanes remain structurally isolated
- **WHEN** a manifest exposes a generation payload through flat restore fallback, overlaps generation and legacy payload roots, or contains inconsistent legacy lane, module, or restore attribution
- **THEN** local profile validation reports the engine-compatible structural error
- **AND** the invalid manifest is not committed

#### Scenario: Unsupported future version is rejected
- **WHEN** a manifest contains a version other than 1 or 2
- **THEN** local profile validation reports `UNSUPPORTED_VERSION`

#### Scenario: Fractional version is rejected
- **WHEN** a manifest contains numeric `version: 2.5`
- **THEN** local profile validation reports `UNSUPPORTED_VERSION`

### Requirement: ZIP import completes only after activation

The GUI SHALL report a ZIP import as successful only after safe staged extraction, validation, atomic commit, exact discovery, selection, and preview of the imported profile complete. A successful import SHALL open the imported profile in the setup review flow without automatically executing Apply. Bare-manifest imports SHALL follow the same validate-before-commit rule and SHALL NOT overwrite an existing profile.

#### Scenario: Valid version 2 bundle import
- **WHEN** the user imports a ZIP whose root manifest is a valid version 2 profile
- **THEN** the extracted profile appears in the local profile list
- **AND** that exact profile is selected
- **AND** its setup review or preview surface is visible
- **AND** the success message is emitted only after those outcomes

#### Scenario: Extracted manifest fails validation
- **WHEN** ZIP extraction succeeds but its manifest is invalid or unsupported
- **THEN** the GUI reports import failure with the validation reason
- **AND** does not show an import-success message

#### Scenario: Unsafe ZIP entry is rejected
- **WHEN** a ZIP contains an absolute, rooted, or parent-traversal entry
- **THEN** the entire import fails
- **AND** no partial or committed profile is left in the profiles directory

#### Scenario: Invalid bare manifest cannot replace a profile
- **WHEN** an imported manifest has the same filename as an existing profile but fails validation
- **THEN** the existing profile remains unchanged
- **AND** the invalid manifest is not committed

#### Scenario: Import does not execute setup
- **WHEN** a valid imported profile is selected and its review surface opens
- **THEN** no Apply command starts until the user explicitly requests it

#### Scenario: Native drop opens visible setup review
- **WHEN** the user drops a supported profile file anywhere in the native window while the engine and import coordinator are idle
- **THEN** the GUI routes to the Setup flow before import preview begins
- **AND** concurrent native drops are rejected until the active import preview settles

#### Scenario: Native drop is blocked during engine work
- **WHEN** capture, preview, apply, or another profile import is active
- **THEN** a native profile drop is rejected before any staging or import command runs
- **AND** the GUI explains that the current operation must finish first

### Requirement: Native Save has an explicit completion state

After a capture file is saved, the GUI SHALL preserve the capture result and display a completion state containing the saved filename or path plus actions for Back to home and Save another copy. It SHALL also offer Open folder when the native save path is known.

#### Scenario: Native capture save succeeds
- **WHEN** the native save dialog returns a path and the capture artifact is copied successfully
- **THEN** the GUI displays `Backup saved`
- **AND** provides Back to home, Open folder, and Save another copy actions

#### Scenario: Browser download succeeds
- **WHEN** the web flow starts a capture download without a known filesystem path
- **THEN** the GUI displays the saved completion state
- **AND** omits Open folder

#### Scenario: User returns home
- **WHEN** the user activates Back to home from the saved completion state
- **THEN** the primary FlowSelector home surface is displayed

#### Scenario: User saves another copy
- **WHEN** the user activates Save another copy
- **THEN** the same preserved capture result is passed through the save dialog again

#### Scenario: Retried second-save cancellation preserves completion
- **WHEN** a second save fails, the user retries, and then cancels the save dialog
- **THEN** the GUI returns to the original `Backup saved` completion state and preserves its saved path

### Requirement: Capture artifact flow has layered automated coverage

The GUI SHALL have a fast Playwright regression that exercises mocked capture progress through Save and version 2 ZIP import into selected setup review. Release verification SHALL separately exercise the packaged engine and installer boundary.

#### Scenario: Pull request regression test
- **WHEN** the fast Playwright suite runs in CI
- **THEN** it verifies a successful capture event renders `DETECTED`
- **AND** a saved capture reaches the completion state
- **AND** a version 2 ZIP import becomes the selected visible setup
- **AND** no winget or real settings capture is required

#### Scenario: Release artifact verification
- **WHEN** a Windows release candidate is built
- **THEN** the packaged engine is smoke-tested from the installer
- **AND** the release does not publish unless the artifact checks succeed
