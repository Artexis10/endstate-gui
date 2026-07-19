## ADDED Requirements

### Requirement: ZIP import completes after visible discovery

The GUI SHALL report a ZIP or bare-manifest import as successful only after safe staging, validation, atomic collision-free commit, exact-path discovery, and visible presentation of the imported profile in the Setup list. Import success SHALL NOT depend on profile selection or setup preview. The imported profile SHALL expose an explicit **Review setup** action, and no preview or Apply command SHALL start until the user requests the corresponding action.

#### Scenario: Valid version 2 bundle import
- **WHEN** the user imports a ZIP whose root manifest is a valid version 2 profile
- **THEN** the extracted profile appears in the local profile list with an **Imported** indicator and **Review setup** action
- **AND** the success message is emitted after exact-path discovery and visible presentation
- **AND** no preview command has run

#### Scenario: Extracted manifest fails validation
- **WHEN** ZIP extraction succeeds but its manifest is invalid or unsupported
- **THEN** the GUI reports import failure with the validation reason
- **AND** does not commit the profile or show an import-success message

#### Scenario: Unsafe ZIP entry is rejected
- **WHEN** a ZIP contains an absolute, rooted, or parent-traversal entry
- **THEN** the entire import fails
- **AND** no partial or committed profile is left in the profiles directory

#### Scenario: Invalid bare manifest cannot replace a profile
- **WHEN** an imported manifest has the same filename as an existing profile but fails validation
- **THEN** the existing profile remains unchanged
- **AND** the invalid manifest is not committed

#### Scenario: Review starts preview explicitly
- **GIVEN** a valid imported profile is visible
- **WHEN** the user activates **Review setup**
- **THEN** the GUI starts exactly one install-only preview for that exact profile
- **AND** no Apply command starts until the user explicitly requests it

#### Scenario: Native drop opens visible Setup list
- **WHEN** the user drops supported profile files anywhere in the idle native window
- **THEN** the GUI routes to the Setup list and imports every supported file exactly once in supplied order
- **AND** the most recently committed profile receives the one-shot imported emphasis
- **AND** no setup preview starts automatically

#### Scenario: Native drop is blocked during engine work
- **WHEN** capture, preview, apply, or another profile import is active
- **THEN** a native profile drop is rejected before any staging or import command runs
- **AND** the GUI explains that the current operation must finish first

## MODIFIED Requirements

### Requirement: Capture artifact flow has layered automated coverage

The GUI SHALL have a fast deterministic Playwright regression that exercises mocked capture progress through Save, transactional version 2 ZIP import, explicit setup review, both restore intents, live restore Apply, and Undo without mutating the host machine. Focused tests SHALL separately cover the native Tauri drag lifecycle. Release verification SHALL audit both Windows installer formats and smoke-test the packaged engine boundary.

#### Scenario: Pull request connected journey
- **WHEN** the semantic Playwright suite runs in CI
- **THEN** it verifies a successful capture event renders `DETECTED` and Save reaches the explicit completion state
- **AND** a version 2 ZIP import becomes visible without issuing preview
- **AND** **Review setup** issues one install-only dry run
- **AND** explicit restore intent issues a fresh dry run with `--enable-restore`
- **AND** selecting a settings module issues live Apply with `--enable-restore --restore-filter`, produces a restore journal in the semantic fixture, and completes undo dry-run plus live revert
- **AND** no winget command or real user-settings mutation is required

#### Scenario: Browser drag presentation test
- **WHEN** Playwright dispatches supported `DataTransfer` enter, over, leave, and drop events
- **THEN** it observes acceptance before drop, cleared state after leave or drop, and one import per supported file in supplied order

#### Scenario: Native Tauri lifecycle test
- **WHEN** focused tests expose only the Tauri v2 runtime marker and emit native enter, over, leave, cancel, drop, and unmount transitions
- **THEN** they verify visible state cleanup, routing, ordered exactly-once import, and import-lease blocking

#### Scenario: Release artifact verification
- **WHEN** a Windows release candidate is built
- **THEN** both MSI and NSIS payloads are audited and the packaged engine is smoke-tested from the release payload
- **AND** the release does not publish unless the artifact checks succeed

## REMOVED Requirements

### Requirement: ZIP import completes only after activation

**Reason**: Product review established that importing a portable profile and previewing its machine changes are separate user decisions. Coupling import success to automatic preview made the Setup flow advance unexpectedly and misclassified later preview failures as import failures.

**Migration**: Preserve safe staging, validation, atomic commit, exact discovery, and busy rejection, but end import on the visible profile list and use **ZIP import completes after visible discovery** plus explicit **Review setup**.
