# Change: Polish hosted-backup error rendering, retry visibility, and re-auth

## Why

The hosted-backup pane shipped functional but rough error UX. Three concrete gaps:

1. **Raw engine messages leak through the GUI.** `backup-pane.tsx:315-354` renders `state.error.message` directly. The push/restore toast call sites at `backup-pane.tsx:161,210,242,289` and `restore-wizard.tsx:101,124,204` pass raw `err.message` to the toast. The engine's `remediation` field often contains `` `endstate backup ...` `` CLI commands — useless inside the GUI. Project memory `feedback_friendly_error_ux` explicitly forbids this; the auth pane already solves it with `friendlyAuthError()` (`auth-errors.ts:28-88`) — backup has no equivalent.
2. **Session-loss mid-operation strands the user.** When `AUTH_REQUIRED` fires from any backup command, `App.tsx:2656-2660` nulls the pane state and shows a generic "Session expired" toast. The user must navigate manually back into the Backup tab, sign in again, and re-trigger the operation from scratch.
3. **Network retries are invisible.** The engine retries failed chunks with exponential backoff (`upload.go:368`, `putWithRetry`) but emits no event during the retry — the push dialog goes silent for up to 8s per retry, looking frozen.

## What Changes

- **ADDED** Friendly engine-error rendering: all backup-pane and restore-wizard error displays map error codes via a new `friendlyBackupError()` helper (mirrors `friendlyAuthError`). Raw engine messages and CLI-jargon remediation are never surfaced.
- **ADDED** Chunk retry visibility: when the engine emits a `retrying` chunk event, the push/pull dialogs render "Retrying chunk N of M (attempt X of Y)" in an amber accent, without decrementing progress counts.
- **ADDED** Session re-auth preserves pane state: on `AUTH_REQUIRED`, an inline re-auth dialog opens with the email pre-filled and locked; the pane behind the dialog keeps its data, and dismiss/close leaves the pane intact. Re-auth success refreshes status; the user re-triggers the operation manually.
- **MODIFIED** Push action with streaming progress: the "Quota exceeded error" scenario now defers to friendly error rendering rather than surfacing engine `message` / `remediation` directly.
- **MODIFIED** Subscription checkout via engine command: the "Session lost during checkout" scenario routes through the new re-auth dialog instead of "back to sign-in".

## Impact

- **Affected specs:** `backup-pane` (3 ADDED, 2 MODIFIED requirements)
- **Affected GUI files:**
  - New: `src/lib/backup-errors.ts`, `src/components/app/backup/reauth-dialog.tsx`
  - Modified: `src/components/app/backup/backup-pane.tsx`, `restore-wizard.tsx`, `use-backup-state.ts`, `push-progress-dialog.tsx`, `pull-progress-dialog.tsx`, `src/lib/streaming-events.ts`, `src/App.tsx`
- **Affected engine files** (sibling repo `endstate`):
  - `go-engine/internal/backup/upload/upload.go` (+ pull download path mirror)
  - `docs/event-contract.md`
- **Cross-repo coordination:** retry-visibility GUI work degrades gracefully when the engine PR is not yet pinned — missing `attempt`/`maxAttempts` fields fall back to generic "Retrying…" copy. GUI PR can ship first; engine PR enables the richer copy.
