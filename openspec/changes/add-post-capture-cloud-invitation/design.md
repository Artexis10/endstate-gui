## Context

Endstate's paid tier is hosted backup. Its principles rule out every conventional way of telling people that: no nag screen, no feature timeout, no degraded local behaviour, no telemetry to measure whether the message landed, and no account requirement. What is left is a single well-placed sentence, offered once, at the one moment it is relevant — immediately after the user has saved a local backup and is therefore actively thinking about where their setup lives.

The surface is `save-flow.tsx`'s `phase === 'saved'` terminal card. That is the only state in the GUI that means "a capture succeeded AND the user chose a durable location for it". `phase === 'done'` means the scan finished but nothing was written; the restore/setup flow is a different component entirely.

Constraints that shaped the design:

- PRINCIPLES.md §1 — no nag screen, and the free product is the real product
- PRINCIPLES.md §6 — no background connections; local features never check subscription status against a server
- PRINCIPLES.md §7 — no telemetry, so "did they see it?" can only be answered from local persisted state
- `docs/ux-guardrails.md` — no hidden state, no multiple sources of truth for a count
- `eslint.config.js` — the single active rule forbids native `button` outside `src/components/ui/**`

## Goals / Non-Goals

- Goals: offer Endstate Cloud exactly once, after a real saved capture, to someone who is not already paying; make a second automatic presentation structurally impossible; keep the local completion fully usable whether or not the invitation is answered
- Non-Goals: conversion measurement of any kind; a price; a checkout; a second placement (startup, restore, scan-complete); any change to what the free product does or how it behaves

## Decisions

### Record before present

`cloudInvitationShownAt` is written synchronously in the save handler, before any state update that could render the card. The alternative — recording on dismiss, or in an effect after mount — leaves a window in which the app can crash, be force-quit, or lose power with the invitation shown but unrecorded. On the next capture it would appear again. Twice is a nag. Recording first makes the failure mode "the user never answered and is never asked again", which is the correct direction to fail for a promise like this.

The ordering is testable: the callback asserts that the card is not yet in the document when it fires.

### Session latch in addition to the persisted flags

The persisted flags only suppress the invitation once the parent has written them *and* re-rendered the child with the new values. "Save another copy" re-enters the save path from inside the already-rendered saved card, which is fast enough that relying on that round trip is a correctness assumption about React scheduling. A `useRef` latch, set at the moment of presentation and never cleared, makes a second presentation impossible within a mount regardless of propagation timing. It is deliberately not reset by `resetKey` or "Scan again".

Symmetrically, the card's *visibility* is driven by that latch rather than by `cloudInvitationShownAt === null` — because the flag becomes non-null the instant the card is shown, so reading it for visibility would hide the card immediately.

### Eligibility is evaluated once, at save time

Not continuously during render. A capture that was eligible when saved stays presented even if, say, the subscription status refreshes a second later. This avoids a card that appears and vanishes, and keeps the decision auditable to a single point in the code.

### Subscriber gate reuses the existing shape

`hostedBackupSupported && signedIn && subscriptionStatus === 'active'` is the same expression App.tsx already uses to decide whether to offer the manual hosted push. Reusing it means an active subscriber can never be shown an invitation to something they already pay for, and there is one definition of "active subscriber" rather than two.

Everything short of that — signed out, `grace`, `cancelled`, `none`, or an engine that does not support hosted backup at all — is eligible. The backup pane already renders an explanatory message when hosted backup is unsupported, so the primary action is never a dead end.

### Never two prompts from one capture

The auto-backup consent dialog fires from the same capture completion, gated on `!settings.autoBackupPromptSeen`. `autoBackupConsentPending` mirrors that exact condition (plus "the dialog is currently open"), and suppresses the invitation. The two prompts are mutually exclusive by construction, and the auto-backup one wins because it is about a decision the user has already opted into having.

### One settings count

The scan-complete headline read `configsIncluded.length` while the filter chips, the per-app rows, and now the invitation read `settingsCount` (modules with `status === 'captured'`, falling back to `configsIncluded` when the engine omits structured modules). Those disagree whenever the engine lists a module it did not actually capture. Shipping a third consumer of the number without fixing that would have entrenched a guardrail violation, so the headline moves to `settingsCount` in the same pass, with a test pinning the agreement.

### No price

The GUI's only price is a hard-coded `€4/month` literal in `hosted-backup-signed-out.tsx`, duplicated rather than sourced from the engine or the billing system. Quoting it in an invitation would make the card a sales surface backed by an unreliable number. The card describes what the service does; the pane the user opts into owns the commercial detail.

## Risks / Trade-offs

- **A user dismisses it and later wants Endstate Cloud** → the sidebar entry is always present; dismissal only stops Endstate volunteering the offer.
- **Record-before-present spends the invitation on a crash** → deliberate. The alternative failure mode is a repeat prompt, which is the thing the principle forbids.
- **No measurement of whether this works** → accepted; §7 rules out the alternative.
- **The invitation adds a component-level prop cluster to `SaveFlow`** → kept as plain props with safe defaults, so every existing call site and test is unaffected.

## Migration Plan

Additive. Both fields default to "never presented, never answered", so existing installs are offered the invitation once on their next saved capture and never again. No storage rewrite, no version gate, nothing to roll back beyond reverting the commit — the flags are inert if the card is removed.

## Open Questions

None.
