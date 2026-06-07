## Context

Hosted Backup is shipped and the data path is verified (push → prod R2 → restore is
byte-identical). The only thing missing for "my setup is safe" to be true is that backup is
**manual** — it relies on the user remembering to push. This change makes it automatic
without violating Endstate's "deliberate explicit state" philosophy and without the footguns
that a naive timer-based auto-backup would introduce.

The push-after-capture plumbing already exists but is manual/gated: `App.tsx` already calls
`backupPush(settings, { profile, onEvent })` after a capture (SaveFlow) behind a signed-in +
active-subscription gate. This change is mostly *removing the manual step and adding the
consent / dedup / auth smarts*, not building a new pipeline.

## Goals / Non-Goals

- **Goals:** seamless backup on a meaningful event; an explicit one-time consent moment;
  no version-history churn on no-op captures; graceful, visible degradation when the session
  dies; a reversible Settings control.
- **Non-Goals:** scheduled/timer backups; a background daemon or OS-level scheduling;
  auto-push after apply; auto-restore; bulk multi-profile sweeps.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Consent model | One-time prompt, default-on | An explicit consent moment (honours "deliberate explicit state") with a low-friction default (honours "seamless"). |
| Trigger | Capture only | Capture is the sole event producing new profile content. Apply reads a profile and provisions the machine — it does not modify the profile, so an auto-push after apply is a no-op after dedup. |
| Dedup locus | Engine `backup push --if-changed` | Reliable dedup needs the engine's canonical manifest hash (mod-times are zeroed so identical setups → identical `manifestSha256`). The GUI cannot recompute that without reimplementing engine logic, and hashing the raw profile file is fragile if it carries volatile fields. |
| Auth-failure UX | Silent skip + persistent "Sign in to resume" + one-time toast | A background op must never throw a modal after an unrelated capture. But silence about a *paused safety feature* is the real footgun, so the paused state must be persistent and actionable. |
| In-progress visibility | Subtle inline chip, not the progress modal | "Seamless" means no ceremony; the full `PushProgressDialog` is reserved for explicit manual pushes. |
| Rollout | Capability-gated (dark until `--if-changed` + #59 land) | Never ship a version-churning or status-blind auto-push. |

- **Alternatives considered:**
  - *Silent default-on (no prompt)* — lowest friction but no consent moment; collides most
    with "deliberate explicit state." Rejected.
  - *Default-off opt-in* — most philosophically pure but highest friction; most users never
    discover it, leaving the "is my data safe?" gap open. Rejected in favour of the one-time
    prompt.
  - *GUI-side dedup* (hash the profile locally, store last-pushed hash) — ships without
    engine work, but only reliable if profile files are byte-deterministic for identical
    content; otherwise it churns versions. Rejected for fragility.

## Data flow

`capture success` → eligibility check (supported + signed-in + active sub + `--if-changed`
capability + opted-in) → (first time only) one-time consent prompt → on opt-in →
**background** `backup push --if-changed --profile <capturedPath> [--backup-id <mapped>]` →
engine compares candidate manifest to latest version → **uploaded** (store backupId, update
status, chip → "Backed up ✓") *or* **skipped/unchanged** (success, no new version, no UI
noise). On `AUTH_REQUIRED` → silent skip + persistent "Sign in to resume backups" + one-time
toast; retry on next capture / window focus.

## Risks / Trade-offs

- **Cross-repo coupling** → the GUI is useless without the two engine/substrate
  co-requisites. Mitigation: capability-gate the feature so it stays dark until both land,
  and track the engine work as explicit blocking prerequisites.
- **Version retention churn** (substrate enforces retention; the exact cap is substrate-side
  and was not verifiable from the engine source) → dedup via `--if-changed` is the mitigation
  regardless of the cap number.
- **Stale "you're safe" impression on a dead session** → the persistent, actionable paused
  indicator + one-time toast prevent silent failure; #59 makes the indicator trustworthy.

## Migration Plan

- Extend `AppSettings` with `autoBackupEnabled`, `autoBackupPromptSeen`, `profileBackupIds`;
  default missing fields on load (existing stored settings deserialize without the keys).
- No data migration; no change to existing manual-push behavior. Rollback = remove the
  trigger wiring; the new settings fields are inert if unused.

## Open Questions

- Exact copy for the one-time consent prompt and the "Sign in to resume backups" affordance
  (defer to implementation; must pass the no-CLI-jargon `friendlyBackupError` bar).
- Whether to expose a separate "last checked" vs "last backed up" timestamp when a
  `skipped/unchanged` result means nothing was uploaded (lean: keep one indicator; unchanged
  means the cloud copy is already current).
