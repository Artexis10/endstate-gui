## Why

Substrate's `wire-anonymous-buyer-account-linking` (substrate PR #12)
shipped a `claim_tokens` table and a `POST /api/auth/claim` endpoint so
that buyers who purchased Hosted Backup anonymously (via the
`/endstate` storefront, without first signing in) can attach
credentials to the pre-account substrate created for them. Buyers
receive an email containing a claim URL with the plaintext 32-byte
token. Without GUI support, the loop only closes if the buyer happens
to be on a device that can intercept the `endstate://claim?token=…`
URL, but the deep-link handler is deferred. Until the GUI can accept a
pasted claim code, anonymous purchases remain stranded — substrate has
their subscription row, but they cannot reach the Backup pane.

## What Changes

- The hosted-backup Sign-up form gains an opt-in **claim mode**
  reached via a "Have a Hosted Backup claim code?" text link below
  the existing form. Toggling claim mode hides the email field
  (substrate has the email from Paddle) and surfaces a single paste
  field for the 43-character URL-safe base64 token.
- After a syntactically valid claim code is pasted, the rest of the
  flow (password, confirm-password, 24-word recovery-key dialog, two
  saves required) is the existing Sign-up flow — unchanged.
- On submit, the GUI invokes the engine via a new `backupClaim`
  wrapper (`endstate backup claim --token … --save-recovery-to …`,
  passphrase on stdin) instead of `backupSignup`. The engine performs
  KDF, recovery-mnemonic generation, and `POST /api/auth/claim`; on
  success it returns `BackupSignupData` extended with `email`
  (server-supplied) and `subscriptionStatus`. JWTs persist via the
  same engine-side mechanism `backup signup` uses today.
- The friendly-error map in `auth-errors.ts` gains the four claim
  codes substrate returns: `CLAIM_TOKEN_INVALID`,
  `CLAIM_TOKEN_EXPIRED`, `CLAIM_TOKEN_CONSUMED`, and
  `KDF_TOO_WEAK`. None of these collide with existing codes.

Explicitly out of scope:

- `endstate://claim?token=…` URL scheme handler (deferred — paste
  works fine for v1).
- A new pane component. We extend `sign-up-form.tsx` + the existing
  `auth-pane.tsx`; we do NOT introduce a parallel claim pane or a
  second copy of the recovery-key dialog plumbing.
- The `/api/auth/claim/resend` endpoint. v1 surfaces no resend CTA in
  the GUI; users who hit `CLAIM_TOKEN_EXPIRED` are told to email
  founder@ for a fresh link (matches substrate v1 limitation that
  plaintext tokens are not re-derivable from the hash).
- Cross-repo livewire e2e covering substrate ↔ engine ↔ GUI. Add
  once both PRs ship if regression risk warrants it.

This change depends on a coordinated engine PR shipping
`endstate backup claim`. That subcommand mirrors `endstate backup
signup`: stdin protocol identical, `--save-recovery-to <path>`
identical, but takes `--token <claim-token>` instead of `--email
<addr>` and returns `email` in the envelope `data` block. The GUI PR
cannot merge until the engine binary bumps include `backup claim`.

**Engine PR is open**: [endstate#32](https://github.com/Artexis10/endstate/pull/32)
(`add-backup-claim-subcommand`). ~320 LOC production + ~310 LOC
tests. All engine tests pass
(`go test ./internal/commands/... ./internal/backup/...` green).
Once that engine PR merges and the `predev` rebuild script in this
repo produces a binary containing `backup claim`, this GUI PR
unblocks for merge.

## Capabilities

### New Capabilities

(none — this extends an existing capability)

### Modified Capabilities

- `auth-ui`: gains the claim-code branch in the sign-up form, the
  associated error mapping, and the requirement that the recovery-key
  dialog remains load-bearing in the claim path.

## Impact

- **Modified files (GUI):**
  - `src/components/app/auth/sign-up-form.tsx` — claim-mode toggle,
    paste field, conditional submit path.
  - `src/components/app/auth/auth-errors.ts` — four new error-code
    cases.
  - `src/lib/backup-bridge.ts` — new `backupClaim()` wrapper.
  - No new types — `BackupSignupData` already carries `email` and
    optional `subscriptionStatus`, so the claim envelope reuses it.
- **New tests:**
  - `src/components/app/auth/sign-up-form.test.tsx` — claim-mode
    state machine, paste-field gating, error-code → friendly-message
    mapping. Co-located per testing convention.
  - `src/components/app/auth/auth-errors.test.ts` — extend with the
    four claim codes.
- **Dependency on engine PR:** `endstate backup claim` subcommand.
  Engine repo: `add-backup-claim-subcommand` (coordinated, not yet
  open). GUI PR description must reference the engine PR number; the
  engine binary version pinned via `predev` rebuild script must
  include `backup claim` before merge.
- **No changes to:** sign-in flow, recover flow, recovery-key dialog,
  backup pane, settings persistence, Tauri commands, or the
  engine-bridge protocol.
