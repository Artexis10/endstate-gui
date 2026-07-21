# Change: Add Hosted Backup claim deep links

## Why

Substrate's verified claim page emits `endstate://claim?token=...`, but the
installed desktop app does not register or consume that scheme. The manual
claim-code path is also hidden behind Create account while the onboarding email
points buyers to the wrong screen.

## What Changes

- Register the `endstate` desktop URL scheme and forward cold and warm launches
  into the existing app instance.
- Validate claim URLs strictly and keep accepted tokens in memory only.
- Route valid links directly to a prefilled `Finish account setup` flow.
- Require confirmation before replacing an existing signed-in session.
- Expose `Use purchase code` on the first signed-out Hosted Backup surface.
- Align Substrate's email and verified claim-page wording and fallbacks with the
  app.

## Impact

- Affected specs: `auth-ui`
- Affected Endstate code: Tauri plugins/config, app routing, auth components,
  and focused tests
- Affected integration consumer: Substrate claim email and verified claim page
- New dependencies: official Tauri deep-link and single-instance plugins

