## Why

A user who has just saved their first local backup has no way of learning that Endstate Cloud exists unless they go looking in the sidebar. That is a real gap — the moment right after "my setup is safe on this disk" is the only moment where "…and what if this disk dies?" is a genuine question rather than an interruption.

The reason it has never been filled is that the obvious fill is a nag, and PRINCIPLES.md §1 forbids one outright: *"There will never be a nag screen, a feature timeout, an artificial profile limit, or degraded local behaviour intended to push users toward payment."* So the bar for this change is not "does it convert" but "is it provably not a nag". That means: at most one presentation, ever; only after a capture the user actually saved; never to someone already paying; never blocking anything; never a second prompt from the same capture; and permanently retired by any answer, including the crash-shaped non-answer.

## What Changes

- `src/settings.ts`: two persisted fields — `cloudInvitationShownAt` (ISO string, default `null`) and `cloudInvitationDismissed` (default `false`), following the existing `autoBackupPromptSeen` one-time precedent and carried through every migration path
- `src/components/app/intent/save-flow.tsx`: a non-blocking invitation card in the `phase === 'saved'` terminal state only — six-condition eligibility gate, record-before-present ordering, a session latch so "Save another copy" cannot re-offer it, and two actions (route to the hosted-backup pane, or keep it local) that both retire it permanently
- `src/components/app/intent/save-flow.tsx`: the scan-complete headline's settings count switches from `configsIncluded.length` to the `settingsCount` already used by the chips and app rows — these two numbers disagree whenever the engine reports a module it did not capture, which `docs/ux-guardrails.md` forbids ("must never compute counts differently across UI components")
- `src/App.tsx`: passes the persisted flags, an `autoBackupConsentPending` gate derived from the same condition that opens the auto-backup consent dialog, and the two persistence callbacks; the primary action reuses the existing `handleNavigate('backup')` route
- **No** network call, **no** telemetry, **no** new dependency, **no** price, and **no** change to what the free local product does

## Capabilities

### New Capabilities

- `post-capture-cloud-invitation`: a one-time, non-blocking, permanently-retirable invitation to Endstate Cloud shown after the first saved capture, with record-before-present persistence.

### Modified Capabilities

- `capture-config-visibility`: a single captured-settings count across the capture completion surface.

## Impact

- `src/settings.ts` — Modified: two persisted fields with defaults + all three migration literals
- `src/components/app/intent/save-flow.tsx` — Modified: eligibility gate, invitation card, headline count reconciliation
- `src/App.tsx` — Modified: prop wiring and the two `updateSettings` callbacks
- `src/components/app/intent/save-flow-cloud-invitation.test.tsx` — New: one case per eligibility condition, record-before-present, dismissal permanence, copy pinning
- `src/settings.test.ts` — Modified: defaults, round-trip, legacy-blob defaulting, migration preservation
- `e2e/cloud-invitation.spec.ts` — New: appears once, absent after reload
- Existing test fixtures constructing full `AppSettings` literals — Modified: new fields with defaults
