## ADDED Requirements

### Requirement: Endstate Cloud is the only public name for the managed service

Every user-visible string that names the managed backup service SHALL call it "Endstate Cloud". The GUI SHALL NOT present "Hosted Backup" or "hosted backup" to the user in any pane title, heading, chip, banner, button, toast, error headline, dialog, accessible name, or accessible description. The Endstate product itself SHALL NOT be renamed.

#### Scenario: Pane title

- **WHEN** the user opens the backup pane or the auth pane
- **THEN** the page title reads `Endstate Cloud`

#### Scenario: Status chip states

- **WHEN** the status chip renders in the signed-out, active, grace, cancelled, or signed-in-unsubscribed state
- **THEN** it reads `Sign in to Endstate Cloud`, `Endstate Cloud · Active`, `Endstate Cloud · Fix billing`, `Endstate Cloud · Renew`, or `Subscribe to Endstate Cloud` respectively

#### Scenario: Error headlines

- **WHEN** `friendlyBackupError()` maps `SUBSCRIPTION_REQUIRED`, `RATE_LIMITED`, `BACKEND_ERROR`, `BACKEND_UNREACHABLE`, or `BACKEND_INCOMPATIBLE`
- **THEN** the headline names the service `Endstate Cloud`
- **AND** the error code, tone, body, and CTA action for each case are unchanged

#### Scenario: Accessible names are renamed too

- **WHEN** an accessible name or description names the service, such as the quota meter's `aria-label` or the Setup flow's restore CTA
- **THEN** it names the service `Endstate Cloud`

#### Scenario: Engine without the capability

- **WHEN** the bundled engine does not advertise `features.hostedBackup.supported`
- **THEN** the notice reads `Endstate Cloud is not available with the bundled engine. Update Endstate to enable it.`

### Requirement: The rename SHALL NOT reach identifiers or the engine wire contract

The rename is public terminology only. The `hostedBackup` capabilities JSON key, the `EndstateHostedBackupCapability` type, engine command names and flags, file names, module paths, component and function identifiers, `data-testid` values, settings keys, and localStorage keys SHALL remain unchanged, because they are shared with the Go engine or depended on by tests. Code comments that cite the contract document by its filename SHALL remain unchanged, because that filename is unchanged and the citation stays correct.

#### Scenario: Capability key is unchanged

- **WHEN** the GUI reads `endstate capabilities --json`
- **THEN** it still reads `features.hostedBackup.supported`
- **AND** no engine-facing field is renamed

#### Scenario: Test hooks are unchanged

- **WHEN** an e2e spec selects the status chip or the signed-out backup pane
- **THEN** the `data-testid` values `hosted-backup-chip` and `backup-pane-signed-out` still resolve

#### Scenario: Contract citation is retained

- **WHEN** a comment reads "per Hosted Backup contract §10"
- **THEN** it is left as written, because it names `hosted-backup-contract.md`, whose filename did not change

### Requirement: Scheduled auto-push copy SHALL describe re-upload, not fresh capture

The Continuous protection auto-push sub-toggle's description SHALL state that the scheduled run uploads the setup the user last saved, SHALL state that it does not capture the drift the check found, and SHALL direct the user to save the computer again to record those changes. It SHALL NOT claim that a fresh snapshot is captured or saved. The name of the Continuous protection setting SHALL NOT change, and the phrase "continuous protection" SHALL NOT be used to describe Endstate Cloud.

#### Scenario: Description matches engine behaviour

- **GIVEN** the engine's scheduled auto-push re-uploads the saved manifest with `--if-changed` and performs no capture
- **WHEN** the auto-push sub-toggle is offered in Settings
- **THEN** its description says the daily check sends the setup the user last saved to Endstate Cloud
- **AND** it says the drift the check found is not captured
- **AND** it tells the user to save this computer again to record those changes

#### Scenario: No fresh-capture claim

- **WHEN** the auto-push description renders
- **THEN** it does not claim a fresh snapshot is captured or saved

#### Scenario: Unchanged setups

- **GIVEN** the saved setup is byte-equivalent to the latest uploaded version
- **WHEN** the scheduled auto-push runs with `--if-changed`
- **THEN** the description's promise that unchanged setups are never re-uploaded still holds

#### Scenario: Setting name is preserved

- **WHEN** the Settings surface renders the scheduled drift check
- **THEN** it is still called Continuous protection
- **AND** no Endstate Cloud surface reuses the phrase "continuous protection"
