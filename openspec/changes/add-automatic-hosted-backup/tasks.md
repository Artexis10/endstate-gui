## 0. Prerequisites (cross-repo — BLOCKING; tracked outside this repo)
- [ ] 0.1 Engine: add `backup push --if-changed` — no-op when candidate manifest == latest version's `manifestSha256`; return a `skipped: true` / `unchanged` envelope (no new versionId). Tracked: `Artexis10/endstate#62`.
- [ ] 0.2 Engine + substrate (#59): populate `lastBackupAt` and add quota fields (`quotaUsedBytes`/`quotaTotalBytes`/`versionCount`) to `backup status`; substrate `/api/account/me` returns quota. (Already filed: Artexis10/endstate#59.)
- [ ] 0.3 Engine: advertise `--if-changed` support in the capabilities envelope so the GUI can capability-gate.

## 1. Settings
- [x] 1.1 Extend `AppSettings` (`src/settings.ts`): `autoBackupEnabled: boolean`, `autoBackupPromptSeen: boolean`, `profileBackupIds: Record<string, string>`; default missing fields on load.
- [x] 1.2 Unit test: settings load/save round-trip with the new fields + back-compat for settings stored without them.

## 2. One-time consent prompt
- [x] 2.1 Add a non-blocking consent-prompt component under `src/components/app/backup/` (shadcn primitives; toggle pre-set ON), co-located test.
- [x] 2.2 Show it on the first eligible capture when `!autoBackupPromptSeen`; persist `autoBackupEnabled` + set `autoBackupPromptSeen` on dismiss/confirm.
- [x] 2.3 Unit test: prompt shown once only; decline sets `autoBackupEnabled=false`.

## 3. Background push orchestrator
- [x] 3.1 Add `--if-changed` to `PushArgs`/`backupPush` in `src/lib/backup-bridge.ts`; handle the `skipped/unchanged` envelope shape.
- [x] 3.2 Add a small hook/util that runs the auto-push silently (no `PushProgressDialog`) and maps four outcomes: uploaded / skipped-unchanged / auth-required / other-error.
- [x] 3.3 Update the `profileBackupIds` map (first push omits `--backup-id` + passes `--name`, then stores the returned backupId; later pushes pass it).
- [x] 3.4 Unit tests for the four-outcome mapping + mapping persistence.

## 4. Trigger wiring + visibility
- [x] 4.1 Wire the trigger in `src/App.tsx` at the capture-completion hook (after `recordLifecycleEvent('capture', …)`), eligibility-gated.
- [x] 4.2 Add the subtle "Backing up… / Backed up ✓" chip to the capture-complete summary (not the full modal).
- [x] 4.3 Capability gate: only enable auto-backup when the engine advertises `--if-changed`.

## 5. Status surface (auth-paused)
- [x] 5.1 Thread an auth-paused flag through `use-backup-state.ts`.
- [x] 5.2 Extend `last-sync-indicator.tsx` with the persistent "Sign in to resume backups" affordance (warning tint, opens inline re-auth dialog).
- [x] 5.3 One-time toast on the first auth failure per session (no repeats).
- [x] 5.4 Unit tests: paused-state transitions + one-time-toast behavior.

## 6. Settings UI
- [x] 6.1 Add the `autoBackupEnabled` toggle to the Settings surface (reversible; off → no auto-push), co-located test.

## 7. Error handling
- [x] 7.1 `STORAGE_QUOTA_EXCEEDED` from a background push surfaces a persistent friendly quota notice (reuse `quota-notice` vocabulary); transient/unreachable errors are silently skipped + retried.
- [x] 7.2 All copy routes through `friendlyBackupError()` — no raw codes / CLI jargon.

## 8. E2E
- [x] 8.1 `e2e/auto-backup.spec.ts`: capture → auto-push fires (mocked engine) → status flips; first capture shows the prompt once; opt-out disables; auth-fail → paused + single toast.

## 9. Validation
- [x] 9.1 `npm run openspec:validate --all --strict --no-interactive` passes.
- [x] 9.2 `npx vitest run` + coverage thresholds hold.
- [x] 9.3 `npm run test:all` passes.
- [ ] 9.4 Live (livewire) smoke once the engine co-requisites land: real capture → observe silent background push + status flip.
