# Hosted Backup Claim Onboarding Design

**Date:** 2026-07-15
**Status:** Approved direction, pending implementation plan
**Repositories:** `endstate-gui`, `substrate`

## Problem

The paid Hosted Backup onboarding path currently breaks at the browser-to-app
handoff:

- Substrate correctly sends an HTTPS claim link so email clients and users
  without Endstate can open it safely.
- The verified claim page offers `endstate://claim?token=...`, but Endstate does
  not register or handle the `endstate` scheme.
- The manual claim-code field exists only after navigating to Create account
  and opening a low-visibility claim-code branch.
- The email incorrectly tells the buyer to find an "I have a claim code"
  action on the sign-in screen.

The result is a delivered, valid claim that looks unusable.

## Goals

- Make the primary claim link open installed Endstate directly into a
  prefilled account-setup flow.
- Leave only the required password and recovery-key steps for the buyer.
- Keep an obvious manual purchase-code path when native launch is unavailable.
- Handle both cold app starts and links opened while Endstate is already
  running.
- Keep claim tokens in memory only and preserve existing server-side token
  validation and single-use behavior.

## Non-Goals

- Claiming an account without choosing a password or saving the recovery key.
- Replacing the HTTPS email link with a custom-scheme email link.
- Changing the claim-token format, expiry, hashing, or server API.
- Changing subscription attachment rules for existing accounts.
- Refactoring unrelated Hosted Backup authentication UI.

## Approaches Considered

### 1. Native deep link only

Register and consume `endstate://claim`, then route to the existing hidden
claim form. This fixes the happy path but leaves users stranded when browser or
OS launch fails and does not repair manual discoverability.

### 2. Manual flow only

Remove the native-launch promise and promote a purchase-code button in the
app. This is quick and dependable, but every buyer still has to copy and paste
a bearer token despite already clicking a valid claim link.

### 3. Native deep link plus visible fallback

Register the protocol, route directly to a prefilled claim form, and promote a
manual purchase-code action on the first Hosted Backup screen. Keep the HTTPS
claim page as the trampoline and fallback surface.

**Decision:** Use approach 3. It makes the normal path short without making the
fallback obscure or weakening account recovery requirements.

## Architecture

### Substrate remains the web entry point

The email CTA remains:

`https://substratesystems.io/endstate/claim/<token>`

This page verifies token state before presenting actions. Its primary action
launches:

`endstate://claim?token=<token>`

The page keeps Download Endstate and Copy code available. Activating Open in
Endstate will copy the token on a best-effort basis before attempting the
custom URL, so a failed native launch still leaves the fallback ready.

### Endstate owns native routing

Endstate GUI will use Tauri's official deep-link plugin with a statically
configured `endstate` desktop scheme. The desktop single-instance plugin will
forward links to the existing process and focus or restore the main window.

The frontend will read both:

- startup URLs for a cold launch;
- open-URL events for an already-running app.

A pure parser will accept only the exact contract:

- scheme: `endstate`;
- host: `claim`;
- exactly one `token` query parameter;
- token matches `[A-Za-z0-9_-]{43}`.

Malformed URLs are rejected before any navigation. Tokens are not logged,
stored in localStorage, written to disk, or included in telemetry.

### Claim onboarding is an explicit app state

When a valid claim link arrives while signed out, the app navigates directly
to a claim-specific account-setup state with:

- heading: `Finish account setup`;
- the claim token prefilled and not visually emphasized;
- password and password-confirmation fields;
- primary action: `Finish setup`.

Submission continues to use the existing `backupClaim` engine path and the
existing load-bearing recovery-key dialog. The deep link does not consume the
claim by itself.

When a valid claim link arrives while another account is signed in, Endstate
must not silently replace local credentials. It shows a confirmation explaining
that the purchase link sets up another account. `Sign out and continue` uses
the existing logout path, retains the token in memory, and then opens the
prefilled claim setup. Cancel leaves the current account untouched.

## Manual Fallback

The first signed-out Hosted Backup surface will expose a visible
`Use purchase code` action beside Sign in and Create account. It opens the same
claim-specific setup state with an empty code field.

The existing sign-up footer link will remain as a secondary route and will be
renamed `Use purchase code` for consistency. It is no longer the only place to
discover claiming. Substrate email and claim-page copy will use the same wording
and identify Hosted Backup as the place to find it.

## Data Flow

1. Buyer opens the HTTPS CTA from email.
2. Substrate verifies and renders the claim page.
3. Buyer chooses Open in Endstate.
4. The OS launches Endstate or forwards the URL to the running instance.
5. Endstate validates the URL locally and keeps the token in memory.
6. Endstate routes to `Finish account setup` with the token prefilled.
7. Buyer chooses a password and submits.
8. The existing engine calls Substrate's claim API and receives the account
   identity plus recovery material.
9. The existing recovery-key dialog requires two save methods.
10. Endstate refreshes Hosted Backup status and lands on the backup pane.

## Error Handling

- **Endstate not installed:** the browser remains on the claim page with
  Download Endstate and Copy code actions.
- **Native launch blocked:** the page exposes `App didn't open?` guidance and
  the already-visible copy fallback.
- **Malformed custom URL:** Endstate ignores the payload and shows a generic
  invalid-link message without echoing the URL or token.
- **Expired, invalid, or consumed claim:** keep the existing friendly engine
  error mappings and remediation.
- **Signed-in collision:** require explicit sign-out confirmation before
  opening claim setup.
- **Unsupported bundled engine:** show the existing update-required state and
  retain the in-memory token until the user dismisses or exits the flow; do not
  persist it across restarts.

## Testing

### Endstate GUI

- Parser unit tests for valid URLs and rejected scheme, host, token shape,
  duplicate token, extra path, and unrelated query cases.
- Auth component tests proving a supplied token opens claim mode prefilled and
  still requires matching passwords.
- Routing tests for cold-start and warm-link events, including main-window
  focus and signed-in confirmation behavior.
- Manual fallback test proving `Use purchase code` reaches the empty claim
  setup state from the first signed-out Hosted Backup surface.
- Rust/build verification for deep-link and single-instance plugin wiring.
- Installed Windows smoke test verifying protocol registration, cold launch,
  warm launch, and token prefill.

### Substrate

- Email-template tests asserting the CTA remains HTTPS and the manual wording
  matches the app.
- Claim-page tests asserting the exact encoded custom URL, copy fallback, and
  download fallback.
- A cross-repo installed-app smoke using a non-production test token where the
  environment supports it.

## Acceptance Criteria

- Clicking Open in Endstate from a valid claim page opens or focuses the
  installed app and displays `Finish account setup` with the claim prefilled.
- The buyer is never asked to copy the code on the normal path.
- A buyer can find `Use purchase code` without first entering Create account.
- Email, web page, and app use the same labels and instructions.
- Password creation and two-method recovery-key saving remain mandatory.
- Invalid custom URLs cannot navigate the app or leak token material.
- Cold-start, warm-start, fallback, and installed Windows behavior are covered
  by fresh verification before release.
