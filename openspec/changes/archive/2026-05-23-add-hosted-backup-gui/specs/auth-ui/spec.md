## ADDED Requirements

### Requirement: Sign-in pane visibility gate

The GUI SHALL render the auth pane when `capabilities.features.hostedBackup.supported === true` AND `backup status` reports `signedIn === false`. When hosted backup is unsupported by the bundled engine, the auth pane SHALL NOT render anywhere in the app.

#### Scenario: Signed-out user on supported engine
- **GIVEN** the bundled engine reports `features.hostedBackup.supported = true`
- **AND** `backup status` returns `signedIn = false`
- **WHEN** the app boots
- **THEN** the auth pane is shown as the active page
- **AND** non-hosted-backup flows (Capture, Setup, Verify) remain available via the overview screen

#### Scenario: Engine without hosted-backup support
- **GIVEN** the bundled engine reports no `features.hostedBackup` field or `supported = false`
- **WHEN** the app boots
- **THEN** the auth pane is not reachable
- **AND** a neutral banner reads "Update Endstate to enable Hosted Backup"
- **AND** local provisioning flows continue to work

### Requirement: Sign-in form

The Sign-in tab SHALL accept email and passphrase, invoke `endstate backup login --email <e>` with the passphrase passed via stdin, and on success route to the backup pane.

#### Scenario: Successful sign-in
- **GIVEN** the user enters a valid email and correct passphrase
- **WHEN** they submit the form
- **THEN** the GUI calls `backupLogin({ email, passphrase })` which writes the passphrase to stdin
- **AND** on success transitions to the backup pane
- **AND** the passphrase is never written to a flag, env var, or log

#### Scenario: Sign-in error from engine
- **GIVEN** the engine returns `{ success: false, error: { code, message, remediation } }`
- **WHEN** the form submission resolves
- **THEN** the GUI surfaces the engine's `message` (and `remediation` when present) via a toast
- **AND** the form remains editable
- **AND** the GUI does not fabricate any error text not present in the envelope

### Requirement: Sign-up form

The Sign-up tab SHALL collect email + passphrase + passphrase confirmation, validate them client-side, and on submit kick off the recovery-key flow.

#### Scenario: Valid sign-up submission
- **GIVEN** the user enters a syntactically valid email
- **AND** a passphrase of at least 12 characters
- **AND** a confirmation matching the passphrase
- **WHEN** they submit
- **THEN** the GUI calls `backupSignup({ email, passphrase, saveRecoveryTo })` where `saveRecoveryTo` is a temp path
- **AND** on success opens the recovery-key dialog with the words read from `saveRecoveryTo`

#### Scenario: Passphrase confirmation mismatch
- **GIVEN** the passphrase and confirmation differ
- **WHEN** the user attempts to submit
- **THEN** the form blocks submission and shows an inline error
- **AND** no engine call is made

#### Scenario: Email format invalid
- **GIVEN** the email field does not match a valid email regex
- **WHEN** the user attempts to submit
- **THEN** the form blocks submission and shows an inline error

### Requirement: Recovery-key dialog (load-bearing per contract §1)

After successful signup, the GUI SHALL display a recovery-key dialog that:

- Renders the 24 BIP39 words as a numbered grid (4 columns × 6 rows or 6 × 4)
- Offers three save methods: Save to file, Save as PDF, Copy to clipboard
- Tracks which methods have been used by the user during this dialog session
- Enables a "Continue" button only when AT LEAST TWO save methods have been used
- Cannot be dismissed by Escape, pointer-down-outside, or any close button
- On Continue, deletes the temp recovery-key file at `recoveryKeySavedTo`

#### Scenario: Continue disabled until two saves
- **GIVEN** the recovery-key dialog is open with zero saves used
- **WHEN** the user clicks Save to file and the file dialog returns success
- **THEN** the saves-used count becomes 1
- **AND** the Continue button remains disabled

#### Scenario: Continue enables on second save
- **GIVEN** one save method has already been used
- **WHEN** the user clicks Copy to clipboard
- **THEN** the saves-used count becomes 2
- **AND** the Continue button becomes enabled

#### Scenario: PDF save generates valid file
- **WHEN** the user clicks Save as PDF and the file dialog returns a path
- **THEN** the GUI generates a single-page PDF via jspdf containing all 24 words and the current date
- **AND** writes it to the chosen path
- **AND** marks PDF as saved

#### Scenario: Cannot dismiss without saves
- **GIVEN** the recovery-key dialog is open
- **WHEN** the user presses Escape
- **OR** clicks outside the dialog
- **THEN** the dialog remains open
- **AND** there is no visible close (X) button

#### Scenario: Temp file cleanup on continue
- **GIVEN** two saves have been used
- **WHEN** the user clicks Continue
- **THEN** the GUI invokes `delete_temp_file` with `recoveryKeySavedTo`
- **AND** transitions to the backup pane

### Requirement: Forgot-passphrase recovery flow

The Forgot-passphrase tab SHALL accept email + 24-word recovery mnemonic + new passphrase, invoke `endstate backup recover --email <e>` with the mnemonic and new passphrase via stdin, and on success sign the user in.

#### Scenario: Successful recovery
- **GIVEN** the user enters their email, a valid 24-word mnemonic, and a new passphrase
- **WHEN** they submit
- **THEN** the GUI calls `backupRecover({ email, mnemonic, newPassphrase })` writing mnemonic on line 1 and newPassphrase on line 2 of stdin
- **AND** on success transitions to the backup pane
- **AND** shows a toast "Passphrase reset successfully"

#### Scenario: Recovery token expired
- **GIVEN** the engine returns `error.code = "RECOVERY_TOKEN_EXPIRED"`
- **WHEN** the form submission resolves
- **THEN** the GUI surfaces the error message and remediation
- **AND** allows the user to retry

#### Scenario: Mnemonic word count check (client-side)
- **GIVEN** the user pastes a recovery phrase that is not exactly 24 whitespace-separated words
- **WHEN** they attempt to submit
- **THEN** the form blocks submission with an inline error
- **AND** no engine call is made
