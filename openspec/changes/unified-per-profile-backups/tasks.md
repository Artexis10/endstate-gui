## 1. Engine contract (separate `endstate` repo change — prerequisite)

- [ ] 1.1 Change `resolveBackupID` (`go-engine/internal/backup/upload/upload.go`): when `--backup-id` is absent and `--name` is provided, create a new backup labeled `--name` instead of returning `backups[0]`
- [ ] 1.2 Preserve auto-backup/id path: an explicit `--backup-id` still versions that backup; verify the zero-backups create path is unchanged
- [ ] 1.3 Add/adjust Go tests covering: named push with no id + existing backups → new backup; push with id → new version
- [ ] 1.4 Release engine, then let `engine-drift-check` bump the GUI `ENGINE_VERSION` pin (do NOT hand-edit the pin)

## 2. GUI — id-addressed manual hosting

- [x] 2.1 In `App.tsx` `onPushProfileToCloud`, look up `profileBackupIds[<profileKey>]`; pass `--backup-id` when present, else push with `--name` only — via `buildProfilePushArgs` (`src/lib/cloud-hosting.ts`)
- [x] 2.2 On push success, record `profileBackupIds[<profileKey>] = returnedBackupId` when it was a first host (mirror `runCaptureAutoBackup`'s persistence)
- [x] 2.3 Define the stable `profileKey` derivation — `profileKeyFor` (`src/lib/profile-key.ts`) = the profile's **path** (unique on disk; isolates name collisions); manifest-id deferral documented
- [x] 2.4 Keep the existing pre-push guard (`guardManualPush`) wrapping; graceful `backup estimate` degradation unchanged

## 3. GUI — badge from the id-mapping

- [x] 3.1 `use-backup-name-index.ts` now also exposes `byId`; App derives `cloudEntryByKey` via `resolveCloudEntriesByKey(profileBackupIds, byId)` — resolves by **id**, verified against `backup list`
- [x] 3.2 `setup-flow.tsx` (+ the two dormant consumers `selected-profile-card.tsx`, `manage-profiles-modal.tsx`) derive `cloudEntry` from `cloudBackupIndex.get(profileKeyFor(profile))`, not `.get(profile.name)`
- [x] 3.3 Refresh the cloud index after a successful host (`cloudBackupIndex.refresh()`) + the recorded id both feed the memo so the badge flips without reload
- [x] 3.4 A mapped-but-deleted backup (id absent from list) falls back to "Local only" (covered by `cloud-hosting.test.ts`)

## 4. GUI — auto-backup unchanged; device label + unification deferred to the engine

> Auto-backup keeps its single stable per-machine backup (`auto:this-computer`); this change does not touch it. A GUI-side hostname label was prototyped then **reverted** — fabricating a device name in the GUI violates the thin-presentation-layer contract (and the repo's "display names come from the engine" rule). The better label is moved to a separate **engine** change (engine defaults the backup name to a device label when `--name` is omitted; GUI displays it). Full per-profile *unification* stays deferred for the same root cause: no stable per-capture/machine identity exists yet (engine concern).

- [x] 4.1 `runCaptureAutoBackup` call site unchanged — stable `auto:this-computer` key, label placeholder `"This computer"` (the engine owns the real default label)
- [x] 4.2 Auto-backup first-capture still creates/records the backup id and later captures version the same backup (`auto-backup.test.ts` covers first-push `--name`)
- [~] 4.3 Device label (engine-side default) **and** per-profile unification — **deferred to the engine change** (`../endstate`); GUI is pass-through

## 5. Migration & compatibility

- [x] 5.1 Existing `profileBackupIds` entries (incl. `auto:this-computer`) still resolve; the path-keyed `cloudEntryByKey` simply doesn't surface the machine key as a setup-profile badge (correct)
- [x] 5.2 Legacy `"This computer"` backup remains listed/restorable in the Backup pane (untouched); no destructive migration
- [x] 5.3 No separate runtime gate needed — the pin is already 2.18.0 and passing `--name`/`--backup-id` is safe/inert on any engine; the badge reads real list state regardless

## 6. Tests & verification

- [x] 6.1 Unit tests: manual host first-time (create + record id), re-host (version via id), name-collision isolation, stale-id → Local only (`cloud-hosting.test.ts`, `profile-key.test.ts`)
- [x] 6.2 Unit tests: auto-backup `--name`/`--backup-id` behavior (`auto-backup.test.ts`, unchanged)
- [x] 6.3 Updated `setup-flow` + badge tests for id/path-based resolution; added a regression guard that a name-only match no longer flips the badge
- [x] 6.4 `npx tsc --noEmit`, `npm run lint`, `npx vitest run` green
- [x] 6.5 Live verification (livewire, real engine 2.18.0): hosted a local-only profile (`hugo-desktop`) → row flipped to "Backed up" with no reload; the engine created a **distinct** backup (`This computer` untouched at 5 versions — the exact bug, fixed); CLI confirmed `--name` creates a distinct backup and `--backup-id` versions it; deleting the backup in the cloud reverted the row to "Local only" (stale-id fallback). Console clean throughout.
- [x] 6.6 `openspec validate unified-per-profile-backups --strict`
