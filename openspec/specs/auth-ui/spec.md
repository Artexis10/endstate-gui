# auth-ui Specification

## Purpose

Defines the authentication pane for Hosted Backup: sign-in, sign-up, the load-bearing recovery-key dialog (hosted-backup contract §1), and the forgot-passphrase recovery flow (contract §6). The pane is gated on engine support for hosted backup. Passphrases and recovery mnemonics are passed to the engine via stdin only — never as CLI flags, env vars, or log lines.

## Requirements

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

### Requirement: Sign-up form claim-code branch

The Sign-up tab SHALL surface an opt-in claim-code branch via a text
link "Have a Hosted Backup claim code?" rendered below the existing
form footer. Activating the link SHALL toggle the form into claim
mode. Claim mode SHALL hide the email input (substrate supplies the
email server-side), SHALL render a single paste field for the
claim code, and SHALL keep the password + confirm-password fields,
client-side passphrase length validation, and the
"Already have an account? Sign in" footer link unchanged. A second
text link "Use a regular sign-up instead" SHALL allow the user to
exit claim mode back to the default form without losing any typed
password value.

#### Scenario: Default sign-up form does not show claim input

- **GIVEN** the user has opened the Sign-up tab and not interacted
- **WHEN** the form renders
- **THEN** the email input is visible
- **AND** the password and confirm-password inputs are visible
- **AND** a text link "Have a Hosted Backup claim code?" is visible
- **AND** no claim-code paste field is visible

#### Scenario: Toggling claim mode hides email and reveals paste field

- **WHEN** the user clicks "Have a Hosted Backup claim code?"
- **THEN** the email input is removed from the DOM
- **AND** a single-line claim-code paste field is visible
- **AND** the password and confirm-password inputs remain visible
- **AND** any value the user had typed into the password field is preserved
- **AND** the submit button label updates to "Claim account"

#### Scenario: Returning to default sign-up restores email field

- **GIVEN** the form is in claim mode with a partially-typed password
- **WHEN** the user clicks "Use a regular sign-up instead"
- **THEN** the email input is rendered again
- **AND** the claim-code paste field is removed
- **AND** the password value is preserved
- **AND** the submit button label reverts to "Create account"

### Requirement: Claim-code paste field validation

The claim-code paste field SHALL accept a 43-character URL-safe
base64 token (alphabet `[A-Za-z0-9_-]`). The form SHALL trim
leading/trailing whitespace from the pasted value before validating.
If the trimmed value begins with `endstate://claim?token=`, the form
SHALL strip that prefix before validating, allowing users to paste
the deep-link URL directly. The submit button SHALL remain disabled
until the (trimmed, prefix-stripped) value matches the regex AND the
password ≥ 12 chars AND password === confirm.

#### Scenario: Submit disabled until claim code matches expected shape

- **GIVEN** the form is in claim mode
- **AND** the password and confirm fields are valid
- **WHEN** the user pastes the string "not-a-token"
- **THEN** the submit button is disabled
- **AND** an inline error reads "Enter a valid claim code."

#### Scenario: Pasted deep-link URL is normalized to the token

- **GIVEN** the form is in claim mode
- **WHEN** the user pastes
  "endstate://claim?token=AAAA-bb_cc-DDD-eeff-GGG-hhii-JJJK-lmnp-Qrst"
- **THEN** the form strips the `endstate://claim?token=` prefix
- **AND** validates the remaining 43-character token against the regex
- **AND** if the token matches the regex AND password fields are valid,
  the submit button is enabled

#### Scenario: Pasted token with surrounding whitespace is accepted

- **GIVEN** the form is in claim mode
- **WHEN** the user pastes a valid 43-char token surrounded by spaces
  or trailing newline characters
- **THEN** the form trims the whitespace
- **AND** validates the trimmed value
- **AND** if valid, the submit button is enabled

### Requirement: Claim submit invokes backupClaim and feeds recovery-key dialog

On submit while in claim mode, the GUI SHALL call
`backupClaim({ token, passphrase, saveRecoveryTo })` instead of
`backupSignup`. The wrapper SHALL invoke
`endstate backup claim --token <t> --save-recovery-to <p>` with the
passphrase on stdin, never as a flag or environment variable. On
success, the GUI SHALL open the recovery-key dialog using the
`recoveryKeySavedTo` path returned by the engine, identical to the
post-signup path. The email displayed in the recovery-key dialog
SHALL come from the engine response (server-supplied), not from any
input field.

#### Scenario: Successful claim opens the recovery-key dialog

- **GIVEN** the form is in claim mode with a valid token and password
- **WHEN** the user clicks "Claim account"
- **THEN** the GUI calls `backupClaim` with the token, passphrase, and
  a generated `saveRecoveryTo` temp path
- **AND** the password is passed via stdin, never as a flag
- **AND** on success the recovery-key dialog opens with the words
  loaded from `recoveryKeySavedTo`
- **AND** the email shown in the dialog is the `email` field from the
  engine response (NOT a value the user typed)

#### Scenario: Recovery-key dialog still load-bearing in claim path

- **GIVEN** the recovery-key dialog has opened after a successful
  claim
- **WHEN** the user attempts to dismiss the dialog before two saves
- **THEN** the dialog refuses to close, identical to the signup path
- **AND** Continue remains disabled until two save methods have been used

#### Scenario: Passphrase never appears in logs or flags

- **GIVEN** an active claim submission
- **WHEN** the spawned CLI command is inspected (argv, environment)
- **THEN** the passphrase does not appear in argv
- **AND** the passphrase does not appear in environment variables
- **AND** the passphrase is delivered solely via stdin

### Requirement: Friendly error mapping for claim error codes

The GUI SHALL surface friendly, GUI-appropriate copy for every claim
error code substrate's `POST /api/auth/claim` can return, via the
existing `friendlyAuthError` map in
`src/components/app/auth/auth-errors.ts`. The four codes and their
required mappings are:

- `CLAIM_TOKEN_INVALID` (HTTP 401): message
  "That claim code doesn't match any active link." with remediation
  "Double-check the code from your purchase email. The link expires
  after 30 days." No CTA.
- `CLAIM_TOKEN_EXPIRED` (HTTP 401): message
  "This claim link has expired." with remediation
  "Email founder@substratesystems.io to request a fresh link." No
  CTA (no second-form target).
- `CLAIM_TOKEN_CONSUMED` (HTTP 409): message
  "This claim code has already been used to create an account." with
  CTA `{ label: "Sign in", tab: "sign-in" }`.
- `KDF_TOO_WEAK` (HTTP 400): message
  "Your password isn't strong enough." with remediation matching the
  form's min-length copy.

The mappings SHALL NOT surface CLI-jargon remediation text
("Run `endstate ...`") under any branch. The form SHALL display
both `message` and `remediation` (when present) in the same inline
alert used for signup errors, and SHALL display any CTA as a button
that switches the active auth tab when clicked.

#### Scenario: CLAIM_TOKEN_INVALID maps to friendly message

- **GIVEN** the engine returns
  `{ success: false, error: { code: "CLAIM_TOKEN_INVALID", message: "...", remediation: "..." } }`
- **WHEN** the GUI renders the error
- **THEN** the inline alert reads
  "That claim code doesn't match any active link."
- **AND** the remediation reads
  "Double-check the code from your purchase email. The link expires
  after 30 days."
- **AND** no engine-supplied CLI jargon is visible

#### Scenario: CLAIM_TOKEN_CONSUMED offers a Sign-in CTA

- **GIVEN** the engine returns
  `{ success: false, error: { code: "CLAIM_TOKEN_CONSUMED", ... } }`
- **WHEN** the GUI renders the error
- **THEN** the inline alert message reads
  "This claim code has already been used to create an account."
- **AND** a "Sign in" CTA button is visible
- **AND** clicking the CTA switches the active auth tab to `sign-in`

#### Scenario: CLAIM_TOKEN_EXPIRED directs to founder@ without CTA

- **GIVEN** the engine returns
  `{ success: false, error: { code: "CLAIM_TOKEN_EXPIRED", ... } }`
- **WHEN** the GUI renders the error
- **THEN** the inline alert message reads
  "This claim link has expired."
- **AND** the remediation reads
  "Email founder@substratesystems.io to request a fresh link."
- **AND** no CTA button is shown
