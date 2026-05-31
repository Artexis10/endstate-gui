# Change: Add automatic hosted backup (consensual + smart)

## Why

Hosted Backup works end-to-end (push → R2 → restore is byte-identical, verified
2026-05-30), but it is **manual**: the user must remember to push after changing their
setup. That makes "is my data safe?" hollow — every consumer backup product is automatic.
We want hosted backup to feel **seamless** (capture your setup and it's backed up, no
ceremony) while staying **consensual** (Endstate's "deliberate explicit state" philosophy)
and **smart** (don't burn version history on no-op pushes; don't be hostile when the
session dies during a background operation).

## What Changes

- **One-time consent, default-on.** The first time an auto-backup would fire for an
  eligible user, a one-time non-blocking prompt appears with the toggle pre-set ON. The
  decision persists and the prompt is never shown again. A reversible `autoBackupEnabled`
  toggle in Settings is the durable control.
- **Auto-push on capture only.** A successful capture (the sole event that produces new
  profile content) triggers a **background** push — no full progress modal, just a subtle
  inline "Backing up… / Backed up ✓" chip in the capture-complete summary. Apply does NOT
  trigger auto-backup (it provisions the machine; it does not modify the profile).
- **Server-side dedup via engine `backup push --if-changed`.** Auto-push passes
  `--if-changed`; the engine no-ops when the candidate manifest equals the latest version's
  `manifestSha256`. A `skipped/unchanged` result is treated as success with zero UI noise
  and burns no version. (Co-requisite engine work — see Impact.)
- **Profile→backup association.** Auto-backup persists a `profileBackupIds` map so
  capturing a given profile updates *its* backup rather than spawning a new one each time.
- **Silent-but-visible auth handling.** A background `AUTH_REQUIRED` never opens a modal;
  it silently skips, flips the last-sync indicator to a persistent, actionable "Sign in to
  resume backups" state, and shows a one-time toast on the first failure per session. It
  retries on the next capture / window focus.
- **Capability-gated rollout.** Auto-backup stays dark until the engine advertises
  `--if-changed` AND the #59 status fields land — the GUI never ships a version-churning or
  status-blind auto-push.

## Impact

- **Affected specs:**
  - `automatic-backup` (**NEW** capability) — eligibility, one-time consent, capture
    trigger, dedup, profile→backup mapping, background auth/error handling, settings opt-out.
  - `backup-pane` (**MODIFIED**) — the **Last sync indicator** requirement gains a
    "paused — sign in to resume backups" state.
- **Affected code (GUI):** `src/settings.ts` (new fields + migration), `src/App.tsx`
  (capture-completion trigger + inline chip), `src/lib/backup-bridge.ts` (`--if-changed`
  arg), a new consent-prompt component + background-push orchestrator under
  `src/components/app/backup/`, `src/components/app/backup/last-sync-indicator.tsx` +
  `use-backup-state.ts` (auth-paused flag).
- **Cross-repo co-requisites (hard prerequisites — GUI gates on both via a capability check):**
  1. **Engine `backup push --if-changed`** — no-op + `skipped/unchanged` envelope when
     content is unchanged. The engine has no dedup today (`upload.PushVersion` mints a fresh
     versionId unconditionally; no `--if-changed`/`--dedup` flag exists).
  2. **Bug #59** (engine + substrate) — `backup status` must populate `lastBackupAt` and
     quota fields; substrate `/api/account/me` must return quota. Confirmed: `runBackupStatus`
     declares `LastBackupAt` but never assigns it, and `StatusResult` carries no quota fields.
     Trustworthy status is non-negotiable for auto-backup.
- **No breaking changes.** Behavior for ineligible users is unchanged; manual push remains.
