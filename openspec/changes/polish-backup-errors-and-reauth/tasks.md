## 1. D1 — Friendly error rendering (GUI-only)

- [x] 1.1 Create `src/lib/backup-errors.ts` exporting `friendlyBackupError(err)`, `isNetworkErrorCode(code)`, and `FriendlyBackupError` type. Mirror `auth-errors.ts:26-88` pattern; reuse `CLI_JARGON_PATTERN` regex.
- [x] 1.2 Map all hosted-backup error codes: `AUTH_REQUIRED`, `SUBSCRIPTION_REQUIRED`, `NOT_FOUND`, `PERMISSION_DENIED`, `RATE_LIMITED`, `BACKEND_ERROR`, `BACKEND_UNREACHABLE`, `BACKEND_INCOMPATIBLE`, `INTERNAL_ERROR`, `SCHEMA_INCOMPATIBLE`, `STORAGE_QUOTA_EXCEEDED`, `CLAIM_TOKEN_INVALID`, `CLAIM_TOKEN_EXPIRED`, `CLAIM_TOKEN_CONSUMED`, `KDF_TOO_WEAK`, `RESTORE_FAILED`, `VERIFY_FAILED`, plus `UNKNOWN_ERROR` fallback.
- [x] 1.3 Write `src/lib/backup-errors.test.ts`: 24 tests covering every code, CLI-jargon stripping, unknown-code fallback, missing-code handling.
- [x] 1.4 Replace raw `err.message` toasts at `backup-pane.tsx:161,210,242,289` with `friendlyBackupError(err).headline` + tone.
- [x] 1.5 Replace raw toasts at `restore-wizard.tsx:101,124,204` likewise (and add the missing `BackupCommandError` type-narrow at the two upstream catch sites that previously fell through to `err.message`).
- [x] 1.6 Replace error card at `backup-pane.tsx:315-354`: deleted the `/network|timeout|reach/i` regex heuristic; derives `isNetwork` from `isNetworkErrorCode(state.error.code)`; renders `f.headline` / `f.body`; CTA button per `f.cta.action` (`retry` → `state.refresh()`; `reauth` → `onAuthLost()`; `manage-billing` → `handleManage()`; `dismiss` → `state.refresh()`).
- [x] 1.7 Audit existing backup-pane and restore-wizard tests — no test currently asserts on raw engine message text, so no test churn.
- [x] 1.8 Grep-verify: `Grep "showToast\(err\.message" src/components/app/backup/` → 0 hits.

## 2. D3 — Re-auth dialog preserving intent (GUI-only)

- [x] 2.1 Created `src/components/app/backup/reauth-dialog.tsx` wrapping `<SignInForm>` inside a shadcn `<Dialog>`. Props: `{ open, settings, expectedEmail?, onReauthenticated, onDismiss }`. Email locked when `expectedEmail` is set (via new `lockedEmail` prop on SignInForm).
- [x] 2.2 `useBackupState.handleFetchError` no longer nulls `status`/`backups` on AUTH_REQUIRED — pane state is preserved behind the dialog. `onAuthLost` signature stays `() => void`; the parent reads `expectedEmail` from its own state.
- [x] 2.3 Rewired `App.tsx` `onAuthLost`: opens re-auth dialog with `expectedEmail: backupStatusData?.email`. Does NOT null `backupStatusData`/`backupListData`.
- [x] 2.4 On re-auth success: dismiss dialog, refresh status + list. (Different-identity clearing deferred — email is locked when `expectedEmail` is set, so identity can't change in v1.)
- [x] 2.5 Added `reauthOpenRef` in `App.tsx` to suppress recursive `onAuthLost` while the dialog is open.
- [x] 2.6 Wrote `src/components/app/backup/reauth-dialog.test.tsx`: 8 tests covering email lock, success flow, inline auth errors not bubbling, Escape dismissal, unlocked variant.

## 3. D2 — Retry visibility (engine + GUI)

### 3.a Engine (sibling repo `C:\Users\win-laptop\Desktop\projects\endstate`, branch `feat/backup-retry-event`)
- [x] 3.1 Added `EmitBackupChunk(BackupChunkProgress)` to the emitter (and `BackupChunkEvent` type in `internal/events/types.go`). Existing `EmitItem` arity unchanged — preserved for log continuity. Bridges the pre-existing gap where the GUI's `backup-chunk` event type was a paper contract the engine never honored.
- [x] 3.2 `putWithRetry` in `internal/backup/upload/upload.go` now emits a `retrying` `backup-chunk` event BEFORE the backoff sleep, plus `uploading` / `uploaded` / `failed` events alongside the existing item events.
- [x] 3.3 `getParallelChunks` in `internal/backup/download/download.go` emits `downloading` / `verified` / `decrypted` / `failed` backup-chunk events. Pull has no chunk-level retry today; `retrying` is push-only.
- [x] 3.4 Updated `docs/contracts/event-contract.md` to document the new event type, status values, optional retry fields, and consumer guidance for missing optional fields.
- [x] Engine tests: 4 new tests in `internal/events/emitter_test.go` pinning the event shape (uploading, retrying with attempt/maxAttempts, manifest chunk index, disabled emitter). All engine tests still pass.

### 3.b GUI
- [x] 3.5 Extended `BackupChunkEvent` in `src/lib/streaming-events.ts` with optional `attempt`, `maxAttempts`, `current`, `total`. Added `'retrying'` to `BackupChunkStatus` union. The existing `parseStreamingEvent` already accepts `backup-chunk` so no parser change.
- [x] 3.6 `applyPushChunk` / `applyPullChunk` reducers in `use-backup-state.ts` track `retryState` on the progress shape; set on `retrying`, cleared on the next non-retry status for the same chunkIndex. Never decrements the completed count.
- [x] 3.7 `push-progress-dialog.tsx` renders the amber "Retrying chunk N of M (attempt X of Y)" tag when `retryState != null`; falls back to "Retrying…" when `attempt`/`maxAttempts` are absent (older engine compat).
- [x] 3.8 `pull-progress-dialog.tsx` mirrors the same (forward-compat — pull doesn't retry today).
- [x] 3.9 Added 3 retry-state reducer tests to `use-backup-state.test.ts`.

## 4. Validation

- [x] 4.1 `npx tsc --noEmit` passes.
- [x] 4.2 `npx vitest run` passes — 1349 passed, 2 skipped (up from 1338 baseline; +35 new tests).
- [x] 4.3 `npx openspec validate polish-backup-errors-and-reauth --strict` passes.
- [x] 4.4 Grep verify: 0 `showToast(err.message` hits in `src/components/app/backup/`; `err.remediation` only appears inside `use-backup-state.ts` where it's captured into state for the friendly mapper to consume.
- [ ] 4.5 Live verify via `npm run tauri:dev:browser` (chrome-devtools MCP): induce `BACKEND_UNREACHABLE`, `STORAGE_QUOTA_EXCEEDED`, `AUTH_REQUIRED` mid-list, chunk retry. Requires re-pinning the engine binary first; deferred to a follow-up session.
