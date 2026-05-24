## ADDED Requirements

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
