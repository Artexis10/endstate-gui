# wire-account-portal-handoff

## Why

The GUI's "Manage subscription" button currently deep-links to
`https://substratesystems.io/endstate` (the marketing page). Customers
who want to update their card, cancel, or check renewal land on a sales
page with no view of their subscription state and no actions. The same
problem exists in Settings → Account, which points at the not-yet-built
`/account` URL.

Wave 1 of the hosted-backup polish plan closes this. Substrate now
renders a themed `/account` page that owns the *view* of the
subscription and hands off management actions to Paddle's hosted portal.
The engine mints a 60-second JWT for the GUI to use as a handoff token.

This change rewires both GUI manage surfaces to the new flow.

## What changes

- **Bridge.** New `backupBrowserSession(settings)` function in
  `src/lib/backup-bridge.ts` calls `endstate backup browser-session
  --json` and returns `{ sessionToken, accountUrl }`.
- **Types.** New `BackupBrowserSessionData` in `src/types.ts`.
- **Backup pane.** `handleManage` in `backup-pane.tsx` no longer hardcodes
  `https://substratesystems.io/endstate`. It calls the new bridge,
  composes `${accountUrl}?session=${sessionToken}`, opens the URL via
  `openExternal`. AUTH_REQUIRED routes to `onAuthLost`; other engine
  errors flow through `friendlyBackupError` to a toast. A
  `managePending` state guards against double-click.
- **Subscription banner.** New optional `managePending` prop disables the
  Manage button while the engine round-trip is in flight; button label
  flips to "Opening…".
- **Account section.** Same `handleManageSubscription` rewire as
  backup-pane. The component gains an optional `onAuthLost` prop so
  `App.tsx` can route to the existing re-auth dialog symmetric with the
  backup-pane wiring.
- **E2E.** New `e2e/backup-browser-session.spec.ts` mirrors
  `backup-subscribe.spec.ts`: active happy path, grace happy path,
  AUTH_REQUIRED dialog, double-click guard.

The substrate routes + page (PR
`substrate-systems/substrate#16`) and the engine command (PR
`Artexis10/endstate#42`) are merged separately. This change pins
`ENGINE_VERSION` to the engine release that ships `backup browser-session`.

## Impact

- Affected specs:
  - `backup-pane` — interim-URL caveat removed; Manage button uses the
    engine bridge.
  - `account-ui` — interim-URL caveat removed; Manage button uses the
    engine bridge.
- Affected code:
  - `src/types.ts` (+15 LOC)
  - `src/lib/backup-bridge.ts` (+12 LOC)
  - `src/components/app/backup/backup-pane.tsx` (~+35 LOC in handleManage
    + state)
  - `src/components/app/backup/subscription-banner.tsx` (+8 LOC)
  - `src/components/app/account/account-section.tsx` (~+35 LOC)
  - `src/App.tsx` (~+5 LOC: pass onAuthLost to AccountSection)
  - `e2e/backup-browser-session.spec.ts` (new, ~250 LOC)
- Dependencies:
  - Engine ≥ the release that ships `backup browser-session`. Bumps
    `ENGINE_VERSION` to that tag.
  - Substrate must have deployed `/api/auth/browser-session` +
    `/account/start` + `/account/page.tsx` (PR #16) for the flow to work
    end-to-end. E2E tests mock the engine envelope so they pass without
    the substrate deploy.
