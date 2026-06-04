## Why

Hosted Backup has two conflicting mental models. The engine + silent auto-backup treat the cloud as **one rolling backup of "this machine"**, while the Setup-flow UI presents **a named cloud copy per profile** (a "Back up to cloud" action + a per-profile "Backed up / Local only" badge). The conflict is a live bug: clicking "Back up to cloud" pushes successfully but the badge never flips to "Backed up", and repeated pushes silently pile versions onto a single backup. Root cause (verified live): the engine's `resolveBackupID` ignores `--name` and appends to `backups[0]` whenever any backup exists, so no cloud backup ever bears the profile's name — and the GUI badge matches **by name**. The product direction is curated, shareable profiles ("gaming-rig", "work-laptop"), so we unify on the per-profile model and address backups by stable **id**.

## What Changes

- **Unify on profiles**: the cloud holds **named profiles**, each addressed by a backend-assigned **id**. No special `"This computer"` entry going forward.
- **GUI manual hosting becomes id-addressed**: the "Back up to cloud" / host action consults the `profileBackupIds` (profile-key → backupId) map — passing `--backup-id` to add a **version** to the profile's existing backup, or creating one (label = profile name) and recording the returned id on first host.
- **Per-profile badge derives from the id-mapping**, verified against `backup list` **by id** — not by name-matching. Fixes the never-flips bug permanently.
- **Auto-backup joins the unified model**: after capture it pushes the **captured profile** under its own name/key (recorded id), instead of a generic `"This computer"` — so a silent backup and an explicit host are the *same* object (no duplication).
- **BREAKING (engine contract dependency)**: the engine's `backup push` must **create a new backup when `--name` is given with no `--backup-id`**, rather than collapsing onto `backups[0]`. Tracked as a separate change in the `endstate` repo; this GUI change depends on it.
- **Non-destructive migration**: the existing `"This computer"` backup and any current `profileBackupIds` entries remain valid; new per-profile hosting creates new backups.
- **Identity**: durable key = backend-assigned **id** (unique per account); profile **name** is a per-user-unique human **label**. A rename re-labels the same backup (id unchanged). A stable manifest-embedded profile id (for cross-machine identity + sharing) is **deferred**.
- **Share-ready, not built**: cross-user "pull someone's hosted profile" stays additive on the same self-contained profile/zip format; sharing crypto/access is **out of scope** here.

## Capabilities

### New Capabilities
- `profile-cloud-hosting`: per-profile, id-addressed hosted backups in the Setup flow — host/version a profile by id, derive the per-profile cloud badge from the id-mapping, unify auto-backup onto the captured profile, and the engine `backup push` contract this relies on. Includes non-destructive migration of the existing single-backup state.

### Modified Capabilities
<!-- None: backup-pane already pushes with --backup-id and is unaffected; per-profile hosting + badge were not previously specced. -->

## Impact

- **GUI**: `src/App.tsx` (manual push handler `onPushProfileToCloud`, `runCaptureAutoBackup` key/name, `profileBackupIds` read/write), `src/components/app/intent/setup-flow.tsx` (push affordance + badge source), `src/components/app/backup/use-backup-name-index.ts` / `profile-cloud-badge.tsx` (id-based lookup), `src/lib/auto-backup.ts`, `src/settings.ts` (`profileBackupIds` semantics).
- **Engine (separate `endstate` change)**: `go-engine/internal/backup/upload/upload.go` `resolveBackupID` — create-not-collapse when `--name` given without `--backup-id`.
- **Contract coupling**: GUI ↔ engine backup-push semantics (the cross-repo coupling flagged in `CLAUDE.md`).
- **Docs/KB**: `Knowledge Base/Notes/Research/Endstate/hosted-backup-unified-profile-model-2026-06-04.md`.
- **No destructive data migration**; existing backups/versions preserved.
