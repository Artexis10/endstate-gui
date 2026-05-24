## Context

The `auth-ui` capability today implements sign-in / sign-up / recover
across three forms inside a single `AuthPane` card. Sign-up calls
`backupSignup()` → engine → `POST /api/auth/signup`, then opens the
recovery-key dialog. Substrate's claim endpoint is structurally
identical to signup minus the email field (the server already has the
email from Paddle and minted a `claim_tokens` row addressed to it).
The plaintext token reaches the buyer only through their email inbox
— v1 surfaces it via a paste field on the sign-up form, because the
deep-link handler is deferred.

## Goals / Non-Goals

**Goals:**

- Make the smallest possible UX addition that lets an anonymous
  Hosted-Backup buyer attach credentials to their pre-account, with
  the recovery-key dialog still load-bearing on the post-submit path.
- Keep the change additive to the `auth-ui` capability — no new
  pane, no parallel dialog plumbing, no second password validator.
- Preserve gui-thin-layer: GUI does no KDF, no token hashing, no
  direct substrate HTTP. The engine's `backup claim` subcommand owns
  all of that, exactly as `backup signup` does today.
- Map every substrate claim error code to a friendly message in the
  existing `auth-errors.ts` map. No raw "Run `endstate ...`" jargon
  leaks into the UI.

**Non-Goals:**

- `endstate://claim?token=…` deep-link handler.
- A "Resend claim link" button — substrate v1's resend cron sends a
  nudge email (not a re-derived token) because plaintext tokens are
  deliberately not stored server-side. There's nothing the GUI can
  do for a user with `CLAIM_TOKEN_EXPIRED` except direct them to
  email founder@.
- Telemetry / analytics on claim attempts.
- Visual treatment beyond a plain text link + paste field — we are
  not designing a marketing surface for the claim flow.

## Decisions

### Extend `sign-up-form.tsx` rather than introduce a claim pane

The brief explicitly rules out a parallel pane. The state machine of
the sign-up form already owns password + confirm + busy + error; a
boolean `claimMode` flag plus a single `claimCode` field is a strictly
local addition. The form's submit handler branches on `claimMode`:

```
if (claimMode) backupClaim({ token, passphrase, saveRecoveryTo })
else           backupSignup({ email, passphrase, saveRecoveryTo })
```

`onSignedUp` upstream does not care which path produced the
`BackupSignupData`. The recovery-key dialog reads `recoveryKeySavedTo`
the same way and routes to the backup pane the same way.

**Alternative considered:** a third `AuthTab` value `'claim'` with a
dedicated `ClaimForm`. Rejected because (a) it duplicates the
password + confirm + recovery-flow plumbing for the sake of hiding
one field, and (b) the brief constrains the change to ~150 LOC.

### Engine-side subcommand vs. direct HTTP from the GUI

The GUI has no HTTP layer for substrate today; signup, login, and
recover all route through the engine via NDJSON. Adding direct
`fetch()` calls would (a) duplicate KDF + recovery-mnemonic
generation that already lives in the engine for signup, and (b)
violate the gui-thin-layer + cli-source-of-truth specs. We add an
engine PR (`endstate backup claim`) mirroring `backup signup`
verbatim except for the `--token` argument and the `email`
field in the response.

This GUI PR therefore **depends on** the engine PR landing first; the
predev rebuild script will pull the engine binary that contains the
new subcommand. If the engine PR slips, this GUI PR sits in review;
it does not ship a half-wired feature.

### Client-side validation of the claim code

Substrate's tokens are 32 random bytes encoded base64url without
padding → 43 characters from the alphabet `[A-Za-z0-9_-]`. The paste
field validates against `/^[A-Za-z0-9_-]{43}$/` purely to gate the
submit button (so users do not waste a network round-trip on a
typo). The engine is the source of truth — server returns
`CLAIM_TOKEN_INVALID` for any token that doesn't match a hash row,
so the regex is a UX optimisation, not a security boundary.

### Error mapping

We extend `friendlyAuthError` in `auth-errors.ts`, not the form
component. This keeps the form free of switch statements over server
codes and gives us a single, testable mapping table for all auth
codes (the existing convention).

Mappings:

- `CLAIM_TOKEN_INVALID` (401) → "That claim code doesn't match any
  active link." + remediation "Double-check the code from your
  purchase email. The link expires after 30 days." (no CTA — there is
  no second form to point at).
- `CLAIM_TOKEN_EXPIRED` (401) → "This claim link has expired." +
  remediation "Email founder@substratesystems.io to request a fresh
  link." (founder@ direction matches substrate v1 — no automated
  re-issue).
- `CLAIM_TOKEN_CONSUMED` (409) → "This claim code has already been
  used to create an account." + CTA "Sign in" (`tab: 'sign-in'`) —
  the buyer probably set credentials on another device and just
  needs to sign in.
- `KDF_TOO_WEAK` (400) → "Your password isn't strong enough." +
  remediation matching the existing min-length copy in the form.
  Should be unreachable from the GUI because the form enforces
  ≥12 chars before submit, but we map it for completeness.

`BAD_REQUEST` (400) is not specifically mapped — it falls through to
the default branch which surfaces the engine's message verbatim
(stripping only CLI-jargon remediation).

### Why hide the email field in claim mode

The substrate response carries `email`; surfacing an editable email
field would invite users to type a different address than the one
substrate has on record, leading to confusing mismatches when the
backup pane shows a different identity than the form. Hiding the
field also makes it unambiguously clear that this flow does not
create a fresh account against an email of the user's choosing — it
binds credentials to an existing pre-account.

## Risks / Trade-offs

**[Engine PR slip blocks GUI PR]** → Mitigation: the GUI PR is
self-contained except for the `backupClaim` wrapper. We open the GUI
PR in draft mode against `main` only after the engine PR is merged
and the predev rebuild produces a binary containing `backup claim`.
The PR description explicitly cross-references the engine commit.

**[CLI surfaces a new error code we did not anticipate]** → Mitigation:
the default branch of `friendlyAuthError` already preserves the
engine's `message` and strips CLI jargon. New codes degrade
gracefully to "show the engine message" without breaking the UI.

**[Paste field accepts a token that includes a leading/trailing
newline or "endstate://claim?token=…" prefix]** → Mitigation: the
form trims input and runs the regex against the trimmed value. A
defensive secondary path strips an `endstate://claim?token=` prefix
if present (users will copy from the email's text and may grab the
deep-link URL). No need to fully parse — substring-after-`token=`
suffices.

**[Recovery-key dialog timing differs from signup because email is
server-supplied]** → Mitigation: the dialog reads `email` from the
`BackupSignupData` shape; we extend that shape's `email` field to
be authoritative for both paths (signup currently echoes the user's
input back, so this is a no-op for signup callers).

## Migration Plan

This is purely additive. No data migrations. No localStorage schema
changes. No breaking changes to existing components or types. The
new `BackupClaimData` is structurally a superset of `BackupSignupData`
and the form's `onSignedUp` callback continues to accept
`BackupSignupData` (the wider type is upcast at the call site).

Rollback is `git revert` of the GUI PR. The engine subcommand can
remain in place — it has no other callers in v1.
