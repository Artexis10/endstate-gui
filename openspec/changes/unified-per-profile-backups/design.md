## Context

Hosted Backup currently embeds two incompatible models (see `proposal.md`). Verified live via the dev-bridge against the real engine:

- GUI per-profile badge resolves via `cloudBackupIndex.get(profile.name)` — keyed by backup **name** (`use-backup-name-index.ts`).
- The manual "Back up to cloud" handler (`App.tsx` `onPushProfileToCloud`) sends `backup push --profile <p> --name <profileName>` with **no `--backup-id`**, and does not touch `profileBackupIds`.
- Engine `resolveBackupID` (`go-engine/internal/backup/upload/upload.go`): with no `--backup-id` it returns `backups[0].ID` whenever any backup exists, and only `CreateBackup(name)` when the account has zero backups. So `--name` is effectively ignored once a backup exists.
- Net: every manual push appends a version to the first backup (`"This computer"`, created by auto-backup); no backup is ever named after the profile; the name-matched badge never flips.

`profileBackupIds: Record<string, string>` already exists in settings and is used by the silent auto-backup (key `auto:this-computer`) to remember its backup id and pass `--backup-id` on later pushes. The fix generalizes that id-mapping to all profiles.

## Goals / Non-Goals

**Goals:**
- Hosting a profile creates/updates **its own** cloud backup, addressed by a stable backend **id**.
- The per-profile "Backed up" badge reflects real state (verified by id), and updates immediately after a successful host.
- Auto-backup and explicit hosting converge on the same object per profile (no `"This computer"` duplication going forward).
- Keep the model id-addressable and profiles self-contained so cross-user sharing is later additive.
- Non-destructive: existing backups, versions, and `profileBackupIds` entries keep working.

**Non-Goals:**
- Cross-user sharing (share links/import) and its crypto/access model.
- A stable manifest-embedded profile id for cross-machine identity (deferred; name/path key suffices now).
- Reworking the Backup pane's in-pane push/restore (already `--backup-id`-addressed).
- Renaming or deleting the legacy `"This computer"` backup.

## Decisions

**D1 — Address backups by id; name is a label.**
The durable key is the backend-assigned backup id (unique per account). The profile name is a per-user-unique human label. Rationale: ids are stable across rename/move and are the natural shareable handle; name-matching is what caused the bug. Alternative (enforce globally-unique names as the key) rejected: pushes rename fragility back into the contract and needs backend uniqueness enforcement.

**D2 — Local mapping via `profileBackupIds`, keyed by a stable profile key.**
First host of a profile: push with `--name <profileName>`, no id → engine creates a backup → record `profileBackupIds[key] = returnedBackupId`. Subsequent hosts: pass `--backup-id` → new version of the same backup. Key = the profile's stable identity (its name/path today; manifest id later). This reuses the exact mechanism auto-backup already relies on.

**D3 — Engine `resolveBackupID` must create-not-collapse.**
When `--name` is provided and `--backup-id` is absent, the engine SHALL create a new backup labeled `--name` instead of returning `backups[0]`. Auto-backup is unaffected because it records and passes its id after the first push. This is the load-bearing engine change; the GUI behavior depends on it. Tracked as a separate `endstate` change. Alternative (GUI-only workaround: pre-create via a separate command then push with id) rejected as more round-trips and still leaves the misleading `--name` semantics in the engine.

**D4 — Badge from id-mapping, verified against the list.**
A profile shows "Backed up" when `profileBackupIds[key]` exists AND that id is present in `backup list`. Re-key the cloud index by id (or look up by id) instead of by name. This makes the badge truthful even if two profiles share a label, and lets a deleted-in-cloud backup correctly fall back to "Local only".

**D5 — Auto-backup unifies onto the captured profile.**
`runCaptureAutoBackup` pushes the captured profile under its own name/key (recording its id), instead of the fixed `("auto:this-computer", "This computer")`. A silent backup and an explicit host of the same profile become the same backup/version stream.

## Risks / Trade-offs

- **Engine/GUI version skew** → The GUI change is inert (or worse, still collapses) until the engine ships the `resolveBackupID` fix. Mitigation: gate behavior on the engine pin (the GUI already pins/verifies the engine version); land the engine change first, bump the pin, then enable. Until then the badge logic (D4) is still correct because it reads real list state.
- **Legacy `"This computer"` backup lingers** → Two conceptual entries during transition. Mitigation: leave it; it remains restorable. Optionally surface it as a profile-less "machine" entry. No destructive migration.
- **Stale profile key on rename/move** → If the key is name/path-based, renaming a local profile orphans its mapping (re-hosts as a new backup). Mitigation: acceptable now (re-host = new backup); the deferred manifest id removes this later.
- **Name collisions across profiles** → Two profiles labeled the same. Mitigation: D1/D4 make id the key, so collisions are cosmetic, not behavioral.

## Migration Plan

1. Land the engine `resolveBackupID` change in `endstate`; release; bump the GUI engine pin (automated via `engine-drift-check`).
2. Ship the GUI changes (D2/D4/D5) behind the bumped pin.
3. No data migration: existing backups/versions and `profileBackupIds` remain valid. The legacy `"This computer"` backup stays until the user deletes it.
4. Rollback: revert the GUI change; the engine change is backward-compatible (only affects the no-id + `--name` path, which previously misbehaved).

## Open Questions

- Capture/profile-naming over time: does re-capturing the "same" machine produce the same stable profile key (→ versions) or a new timestamped profile (→ new backup)? Resolved for this change by D2 (key = current profile identity); the broader capture-naming policy is engine-side and out of scope.
- Should the legacy `"This computer"` backup be presented as a first-class "machine" profile, or left as an unlabeled legacy entry? Deferred.
