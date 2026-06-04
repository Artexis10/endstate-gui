## 1. Engine contract (separate `endstate` repo change — prerequisite)

- [ ] 1.1 Change `resolveBackupID` (`go-engine/internal/backup/upload/upload.go`): when `--backup-id` is absent and `--name` is provided, create a new backup labeled `--name` instead of returning `backups[0]`
- [ ] 1.2 Preserve auto-backup/id path: an explicit `--backup-id` still versions that backup; verify the zero-backups create path is unchanged
- [ ] 1.3 Add/adjust Go tests covering: named push with no id + existing backups → new backup; push with id → new version
- [ ] 1.4 Release engine, then let `engine-drift-check` bump the GUI `ENGINE_VERSION` pin (do NOT hand-edit the pin)

## 2. GUI — id-addressed manual hosting

- [ ] 2.1 In `App.tsx` `onPushProfileToCloud`, look up `profileBackupIds[<profileKey>]`; pass `--backup-id` when present, else push with `--name` only
- [ ] 2.2 On push success, record `profileBackupIds[<profileKey>] = returnedBackupId` when it was a first host (mirror `runCaptureAutoBackup`'s persistence)
- [ ] 2.3 Define the stable `profileKey` derivation for a Setup-flow profile (name/path now; document the manifest-id deferral) and use it consistently for lookup + persistence
- [ ] 2.4 Keep the existing pre-push guard (`guardManualPush`) wrapping; confirm graceful degradation when `backup estimate` is unavailable

## 3. GUI — badge from the id-mapping

- [ ] 3.1 Change the cloud index (`use-backup-name-index.ts`) or its consumer so the Setup-flow badge resolves by **id** (via `profileBackupIds`), verified against `backup list`
- [ ] 3.2 Update `setup-flow.tsx` row logic to derive `cloudEntry` from the mapped id rather than `cloudBackupIndex.get(profile.name)`
- [ ] 3.3 Refresh the cloud index after a successful host so the badge flips without reload
- [ ] 3.4 Ensure a mapped-but-deleted backup (id absent from list) falls back to "Local only"

## 4. GUI — unify auto-backup

- [ ] 4.1 Change `runCaptureAutoBackup` call site so it uses the captured profile's own name/key instead of the fixed `("auto:this-computer", "This computer")`
- [ ] 4.2 Verify auto-backup first-capture creates the profile's backup (records id) and later captures version the same backup
- [ ] 4.3 Confirm an explicit host and a silent auto-backup of the same profile resolve to the same backup id

## 5. Migration & compatibility

- [ ] 5.1 Confirm existing `profileBackupIds` entries (incl. `auto:this-computer`) still resolve and are not broken by the key changes
- [ ] 5.2 Confirm the legacy `"This computer"` backup remains listed and restorable; add no destructive migration
- [ ] 5.3 Gate the new GUI behavior on the bumped engine pin so it does not ship ahead of the engine contract

## 6. Tests & verification

- [ ] 6.1 Unit tests: manual host first-time (create + record id), re-host (version via id), name-collision badge isolation, stale-id fallback to Local only
- [ ] 6.2 Unit tests: auto-backup unification (captured profile key/name, id persistence)
- [ ] 6.3 Update/extend `setup-flow` + badge tests for id-based resolution; update any name-match assumptions
- [ ] 6.4 `npx tsc --noEmit`, `npm run lint`, targeted `npx vitest run` green
- [ ] 6.5 Live verification (livewire, real engine ≥ pinned version): host a local-only profile → row flips to "Backed up"; re-host → new version on same backup; second profile hosts as a distinct backup
- [ ] 6.6 `openspec validate unified-per-profile-backups --strict`
