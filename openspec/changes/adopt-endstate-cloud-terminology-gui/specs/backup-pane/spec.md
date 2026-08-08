## MODIFIED Requirements

### Requirement: Subscription banner

The backup pane SHALL render a subscription-state banner reflecting `status.subscriptionStatus`. The banner colour and copy SHALL match the four documented states (`active`, `grace`, `cancelled`, `none`) per contract §10. Copy that names the managed service SHALL name it Endstate Cloud.

#### Scenario: Active subscription
- **GIVEN** `status.subscriptionStatus === "active"`
- **WHEN** the backup pane renders
- **THEN** the banner reads "Endstate Cloud active" in success colour
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
- **THEN** the banner reads "Subscribe to enable Endstate Cloud" with a Subscribe button
- **AND** the Subscribe button begins checkout (see "Subscription checkout via engine command")

#### Scenario: Manage handoff AUTH_REQUIRED
- **GIVEN** the user is signed in but the engine reports `AUTH_REQUIRED` from the `backup browser-session` call (e.g. session expired between status fetch and click)
- **WHEN** the click handler catches the error
- **THEN** it does NOT call `openExternal`

### Requirement: Friendly engine-error rendering

The backup pane and restore wizard SHALL map every engine error to GUI-appropriate copy via a shared `friendlyBackupError()` helper before rendering. The helper SHALL produce a `headline` and optional `body`, `cta`, and `tone`, and SHALL strip CLI-jargon (e.g., `` Run `endstate ...` ``) from the engine's `remediation` field. Raw `error.message` or unfiltered `error.remediation` SHALL NOT be surfaced in any toast, dialog, or inline error. Headlines that name the managed service SHALL name it Endstate Cloud.

#### Scenario: Network unreachable error
- **GIVEN** the engine returns `error.code === "BACKEND_UNREACHABLE"`
- **WHEN** the pane renders the error
- **THEN** the headline reads a friendly network-failure message (e.g., "Can't reach Endstate Cloud")
- **AND** a `Retry` CTA invokes the pane's refresh action
- **AND** the engine's raw `error.message` is not visible

#### Scenario: Quota exceeded
- **GIVEN** the engine returns `error.code === "STORAGE_QUOTA_EXCEEDED"`
- **WHEN** the pane renders the error
- **THEN** the headline reads a friendly quota message
- **AND** the tone is `warning` (not destructive)
- **AND** if the engine `remediation` contains backtick-prefixed `endstate` commands, they are not rendered

#### Scenario: Unknown error code fallback
- **GIVEN** the engine returns an unrecognized `error.code`
- **WHEN** the pane renders the error
- **THEN** the helper falls back to the engine's `message` but strips `remediation` if it matches the CLI-jargon pattern

#### Scenario: AUTH_REQUIRED triggers reauth CTA
- **GIVEN** an error with `code === "AUTH_REQUIRED"` reaches the error card
- **WHEN** the user clicks the CTA
- **THEN** the re-auth dialog opens (per "Session re-auth preserves pane state")
