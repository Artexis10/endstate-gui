## ADDED Requirements

### Requirement: Native Hosted Backup claim-link handling

The desktop GUI SHALL register the `endstate` URL scheme and SHALL handle
`endstate://claim?token=<token>` when starting from a closed state and when an
instance is already running. A warm launch SHALL focus or restore the existing
main window instead of leaving the claim in a second background instance. On
Windows and Linux, startup SHALL also attempt to register the `endstate`
deep-link scheme for the current executable so a normal launch can
repair missing installer or desktop integration state. A failed repair SHALL
NOT prevent the GUI from opening and SHALL NOT log a URL or claim token.

#### Scenario: Startup repairs missing protocol registration
- **GIVEN** Endstate is running on Windows or Linux
- **AND** the statically configured `endstate` scheme is missing or points to
  an older executable location
- **WHEN** the application startup setup runs
- **THEN** the GUI attempts to register the `endstate` scheme for the current
  executable
- **AND** the normal application window opens even if OS registration fails
- **AND** no claim URL or token is read, persisted, or logged by the repair

#### Scenario: Cold claim launch
- **GIVEN** Endstate is installed and not running
- **WHEN** the operating system opens a valid claim URL
- **THEN** Endstate starts and navigates to claim account setup
- **AND** the claim token is prefilled

#### Scenario: Cold claim waits for a failed session check
- **GIVEN** a valid cold claim intent is retained in memory
- **AND** the initial Hosted Backup session check fails without proving the
  user signed out
- **WHEN** the app cannot safely choose direct setup or collision confirmation
- **THEN** it shows a mandatory token-safe session-check retry dialog
- **AND** it does not use a cached status snapshot or expose manual claim entry
  while authoritative session truth is unresolved
- **AND** retry calls `backup status` again
- **AND** a successful retry routes the retained intent using the resolved
  signed-in state

#### Scenario: Startup session check fails without a claim
- **GIVEN** no claim intent is pending
- **WHEN** the initial Hosted Backup session check fails without resolving the
  current session
- **THEN** the Auth and Hosted Backup checking surfaces show an inline retry
  control
- **AND** the GUI does not show a blocking session-check dialog
- **AND** the rest of Endstate remains usable
- **AND** manual claim entry remains unavailable until the session is resolved

#### Scenario: Warm claim launch
- **GIVEN** Endstate is already running and no recovery-key dialog is pending
- **WHEN** the operating system opens a valid claim URL
- **THEN** the existing main window is focused or restored
- **AND** the current view is replaced by claim account setup with the new token

#### Scenario: Warm claim waits for recovery completion
- **GIVEN** a mandatory recovery-key dialog is pending
- **WHEN** the operating system opens one or more valid claim URLs
- **THEN** the current auth pane and recovery dialog remain mounted
- **AND** only the latest claim intent is retained in memory
- **AND** after recovery and status refresh complete, the latest intent is
  handled against the current signed-in state

### Requirement: Ordered claim-session status

The GUI SHALL apply a session-defining `backup status` result to claim routing
only when it is the newest session-defining request in the current
authentication epoch. A best-effort background request SHALL NOT supersede an
in-flight session-defining request. Successful authentication, logout, account
deletion, and `AUTH_REQUIRED` SHALL invalidate all status requests started
before that transition.

#### Scenario: Pre-authentication status resolves late
- **GIVEN** a status request started before successful authentication
- **WHEN** that older request resolves after authentication advances the epoch
- **THEN** its result is ignored
- **AND** it cannot route a deferred claim as signed out

#### Scenario: Pre-logout status resolves late
- **GIVEN** a status request started while signed in
- **WHEN** it resolves after logout or account deletion advances the epoch
- **THEN** its result is ignored
- **AND** it cannot restore signed-in routing or UI

#### Scenario: Background refresh overlaps startup resolution
- **GIVEN** a session-defining startup status request is in flight
- **WHEN** a newer best-effort background refresh starts and fails
- **THEN** the background failure is ignored
- **AND** the older successful startup result remains effective

#### Scenario: Session resolution supersedes a background refresh
- **GIVEN** a best-effort background status request is in flight
- **WHEN** a newer session-defining request starts
- **THEN** the older background result is ignored
- **AND** only the session-defining request can resolve current session truth

### Requirement: Strict and ephemeral claim-link parsing

The GUI SHALL accept only URLs with scheme `endstate`, host `claim`, no path,
exactly one `token` query parameter, no unrelated query parameters, and a token
matching `[A-Za-z0-9_-]{43}`. It SHALL reject all other URLs before navigation.
Claim URLs and tokens SHALL NOT be logged or persisted to localStorage, files,
or telemetry.

#### Scenario: Exact claim URL accepted
- **WHEN** the GUI receives `endstate://claim?token=<valid-43-char-token>`
- **THEN** it produces an in-memory claim intent containing the token

#### Scenario: Malformed or expanded URL rejected
- **WHEN** the GUI receives a URL with another scheme or host, a path, a missing
  or duplicate token, an unrelated query parameter, or an invalid token shape
- **THEN** it does not navigate to claim setup
- **AND** it does not echo the URL or token in user-facing or diagnostic output

### Requirement: Streamlined claim account setup

A valid claim intent SHALL open a view headed `Finish account setup` with the
claim token prefilled. The buyer SHALL only need to enter and confirm a password
before invoking the existing claim command and recovery-key flow. The link
itself SHALL NOT consume the token.

#### Scenario: Buyer finishes a prefilled claim
- **GIVEN** a valid claim intent has opened account setup
- **WHEN** the buyer enters matching valid passwords and submits
- **THEN** the GUI invokes the existing `backupClaim` path with the prefilled
  token
- **AND** successful claim continues to the mandatory recovery-key dialog

### Requirement: Discoverable purchase-code fallback

The first signed-out Hosted Backup surface SHALL expose a visible
`Use purchase code` action beside the existing Sign in and Create account
actions. It SHALL open the same claim setup with an empty claim-code field. The
sign-up footer claim action SHALL use the same wording.

#### Scenario: Buyer finds manual claim without entering sign-up
- **GIVEN** the buyer is signed out on the first Hosted Backup surface
- **WHEN** they choose `Use purchase code`
- **THEN** `Finish account setup` opens with an empty purchase-code field

### Requirement: Signed-in claim collision confirmation

The GUI MUST preserve the current session when a valid claim intent arrives
while another account is signed in, until the user explicitly chooses
`Sign out and continue`. Confirming SHALL use the existing logout path, retain
the token only in memory, and then open prefilled claim setup. Canceling SHALL
leave the current session unchanged.

#### Scenario: Signed-in buyer confirms account switch
- **GIVEN** Endstate is signed in when a valid claim intent arrives
- **WHEN** the user chooses `Sign out and continue`
- **THEN** the existing logout path completes before claim setup opens
- **AND** the claim token remains available only in memory

#### Scenario: Signed-in buyer cancels
- **GIVEN** Endstate is signed in when a valid claim intent arrives
- **WHEN** the user cancels the confirmation
- **THEN** the current session and view remain unchanged
- **AND** the pending token is discarded

## MODIFIED Requirements

### Requirement: Recovery-key dialog (load-bearing per contract §1)

After successful signup, the GUI SHALL display a recovery-key dialog that:

- Renders the 24 BIP39 words as a numbered grid (4 columns × 6 rows or 6 × 4)
- Offers three save methods: Save to file, Save as PDF, Copy to clipboard
- Tracks which methods have been used by the user during this dialog session
- Enables a "Continue" button only when AT LEAST TWO save methods have been used
- Cannot be dismissed by Escape, pointer-down-outside, any close button, or an
  incoming claim intent
- On Continue, deletes the temp recovery-key file at `recoveryKeySavedTo`
- Keeps claim routing locked until post-authentication status refresh and
  navigation complete

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

#### Scenario: Incoming claim does not interrupt recovery
- **GIVEN** the recovery-key dialog is open
- **WHEN** a valid warm claim intent arrives
- **THEN** the current auth pane and recovery dialog remain mounted
- **AND** the latest incoming intent is deferred in memory

#### Scenario: Temp file cleanup on continue
- **GIVEN** two saves have been used
- **WHEN** the user clicks Continue
- **THEN** the GUI invokes `delete_temp_file` with `recoveryKeySavedTo`
- **AND** completes the status refresh and transitions to the backup pane
- **AND** only then releases any deferred claim intent

### Requirement: Sign-up form claim-code branch

The Sign-up tab SHALL surface an opt-in claim-code branch via a text
link "Use purchase code" rendered below the existing form footer.
Activating the link SHALL toggle the form into claim mode. Claim mode
SHALL hide the email input (substrate supplies the email server-side),
SHALL render a single paste field labeled "Purchase code", and SHALL
keep the password + confirm-password fields, client-side passphrase
length validation, and the "Already have an account? Sign in" footer
link unchanged. A second text link "Use regular sign-up instead" SHALL
allow the user to exit claim mode back to the default form without
losing any typed password value. Navigating away from claim mode SHALL
clear claim mode so returning to Sign-up does not resurrect it.

#### Scenario: Default sign-up form does not show claim input

- **GIVEN** the user has opened the Sign-up tab and not interacted
- **WHEN** the form renders
- **THEN** the email input is visible
- **AND** the password and confirm-password inputs are visible
- **AND** a text link "Use purchase code" is visible
- **AND** no purchase-code paste field is visible

#### Scenario: Toggling claim mode hides email and reveals paste field

- **WHEN** the user clicks "Use purchase code"
- **THEN** the email input is removed from the DOM
- **AND** a single-line "Purchase code" paste field is visible
- **AND** the password and confirm-password inputs remain visible
- **AND** any value the user had typed into the password field is preserved
- **AND** the submit button label updates to "Finish setup"

#### Scenario: Returning to default sign-up restores email field

- **GIVEN** the form is in claim mode with a partially-typed password
- **WHEN** the user clicks "Use regular sign-up instead"
- **THEN** the email input is rendered again
- **AND** the purchase-code paste field is removed
- **AND** the password value is preserved
- **AND** the submit button label reverts to "Create account"

#### Scenario: Navigating away clears claim mode

- **GIVEN** the form is in native or manual claim mode
- **WHEN** the user navigates to Sign in and then returns to Sign-up
- **THEN** the regular Sign-up form is rendered
- **AND** the claim heading and any prefilled claim token are not resurrected

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
- **WHEN** the user clicks "Finish setup"
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
