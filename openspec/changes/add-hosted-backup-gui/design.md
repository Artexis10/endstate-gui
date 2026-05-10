## Design Decisions

### Engine boundary remains absolute

All cryptography, HTTP, JWT validation, keychain access lives in the engine. The GUI calls `endstate backup *` via the existing CLI bridge and renders the JSON envelope plus streaming events. No GUI-side substrate calls. Per `docs/ai/PROJECT_SHADOW.md` and contract §1, this boundary is structural, not a convention we can relax.

### Stdin for secrets — engine_adapter.rs extension

Engine commands that take passphrases or recovery mnemonics (signup, login, recover) read them from stdin, not flags. This is the correct posture — flags leak via shell history, env vars are worse. The Tauri Rust adapter currently has no stdin write path; we add minimal stdin support to `engine_adapter.rs` plus a new `engine_run_with_stdin` Tauri command. No other Rust changes. The engine_adapter file is on the protected list (`docs/ai/AI_CONTRACT.md`); this edit is user-authorised and called out in the PR description.

### Streaming events: separate `BackupChunkEvent`, not overloaded `ItemEvent`

The engine emits chunk-progress events with phase `backup-push` or `backup-pull` and status values (`uploading | uploaded | downloading | verified | decrypted | failed`) that don't map to the existing `EngineItemStatus` union. Following the `RestoreItemEvent` precedent already in `src/lib/streaming-events.ts:124-136`, we add a new `BackupChunkEvent` variant rather than overloading `ItemEvent`. Type guards (`isBackupChunkEvent`) follow the same shape.

### State management: per-feature hooks, no Zustand

The repo already uses per-feature `useXState` hooks (e.g., `useOverviewState`). We add `useAuthState`, `useBackupPaneState`, `useRecoveryKeyDialogState` in the same pattern. No Zustand / Redux / Context provider — introducing one is out of scope and would be the first store in the codebase.

### Recovery key dialog: load-bearing UX, no escape

Per contract §1, recovery-key generation, presentation, and verification are mandatory at signup. The dialog:

- Renders 24 words as a numbered 4×6 grid with `<dl>` semantics
- Shows three save methods (file via Tauri `save()` dialog, PDF via `jspdf`, clipboard via `navigator.clipboard.writeText`); each tracks a per-method `saved: boolean`
- Enables "I've saved my recovery key, continue" only when ≥ 2 methods have been used
- Has no close button, blocks Escape and pointer-down-outside
- After continue, deletes the engine's temp recovery file at `recoveryKeySavedTo` via a new `delete_temp_file` Tauri command

This is intentionally user-hostile to skip — the alternative is a contract violation that ships a broken trust model.

### PDF library: jspdf (not pdf-lib)

Single-page text layout (24 words + minimal instructions + date). `jspdf` is ~80 KB gzipped vs `pdf-lib`'s ~600 KB; the simpler API matches what we need.

### Subscription portal links: hardcoded

For v1: hardcode the Subscribe URL (`https://substratesystems.io/#pricing`) and Manage Subscription URL (`https://substratesystems.io/account`). Open via Tauri `shell.open` (or whatever the existing external-URL pattern is). If the substrate `/account` route doesn't yet exist, leave a TODO comment — this is a substrate-side follow-up, not a GUI blocker. No engine work needed.

### Cancel during push/pull: existing `engine_cancel`

The existing `engine_cancel` Tauri command kills the engine process. Substrate's 7-day soft-delete window for incomplete uploads (contract §8) handles cleanup automatically — no substrate-side cancel API call needed. Show a calm toast: "Push cancelled. Partial upload will be cleared automatically."

### Account-delete confirmation: GUI-side email match

The engine `endstate account delete --confirm` takes no email argument. The GUI requires the user to type their email; only when `typedEmail.trim() === status.email` does the Confirm button enable. This matches contract §12's "explicit warning + confirmation" requirement without the engine needing to validate.

### Engine version gate

On `cli.initialize()`, read `capabilities.features.hostedBackup.supported`. If absent or `false`: hide all hosted-backup UI elements (auth pane, backup entry, account section) and show a neutral banner "Update Endstate to enable Hosted Backup." The existing schema-version compatibility check (`isSchemaCompatible`) covers major-version mismatches independently.

## Out of scope

- Engine work (none needed; v2.0.0 shipped)
- Substrate work (none needed; v2.0 deployed)
- Custom iconography (use existing Lucide set)
- Localisation (match repo's existing English-only stance)
- New UX language (reuse `docs/ux-language.md` patterns; surface any genuinely new copy in PR review)
- Substrate-side `/account` route (follow-up if it doesn't exist; GUI ships with the link regardless)
