# backup-pane delta

## MODIFIED Requirements

### Requirement: Subscription banner

The backup pane SHALL render a subscription-state banner reflecting `status.subscriptionStatus`. The banner colour and copy SHALL match the four documented states (`active`, `grace`, `cancelled`, `none`) per contract §10.

#### Scenario: Active subscription
- **GIVEN** `status.subscriptionStatus === "active"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Hosted Backup active" in success colour
- **AND** a Manage subscription button is available — clicking it invokes `endstate backup browser-session`, composes `${accountUrl}?session=${sessionToken}`, and opens the resulting URL via the OS shell (substrate's `/account/start` route swaps the JWT for a session cookie and 302s to the cookie-only `/account` page; see hosted-backup contract §5)
- **AND** while the engine round-trip is in flight the button is disabled and reads "Opening…" — a fast double-click is also blocked by a ref-mirror so the second click never reaches the engine

#### Scenario: Grace state
- **GIVEN** `status.subscriptionStatus === "grace"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Payment failed — fix billing within 30 days to keep backups" in warn colour
- **AND** the Manage subscription button uses the same `backup browser-session` handoff as the active state

#### Scenario: Cancelled state
- **GIVEN** `status.subscriptionStatus === "cancelled"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Subscription cancelled — backups read-only, purged in N days" in error colour
- **AND** a Renew subscription button begins checkout (see "Subscription checkout via engine command")

#### Scenario: None state
- **GIVEN** `status.subscriptionStatus === "none"` or undefined
- **WHEN** the backup pane renders
- **THEN** the banner reads "Subscribe to enable hosted backup" with a Subscribe button
- **AND** the Subscribe button begins checkout (see "Subscription checkout via engine command")

#### Scenario: Manage handoff AUTH_REQUIRED
- **GIVEN** the user is signed in but the engine reports `AUTH_REQUIRED` from the `backup browser-session` call (e.g. session expired between status fetch and click)
- **WHEN** the click handler catches the error
- **THEN** it does NOT call `openExternal`
- **AND** it invokes `onAuthLost`, which routes to the inline re-auth dialog without unmounting the pane (preserves Wave 6 D3 behaviour)

#### Scenario: Manage handoff backend failure
- **GIVEN** the engine returns a non-AUTH_REQUIRED error from `backup browser-session` (BACKEND_UNREACHABLE, SUBSCRIPTION_REQUIRED, etc.)
- **WHEN** the click handler catches the error
- **THEN** it shows a friendly toast via `friendlyBackupError` — no raw CLI jargon
- **AND** no URL is opened
