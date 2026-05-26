## Context

Wave 6 of the hosted-backup GUI polish plan. Cross-cutting because retry visibility couples a small engine event-contract addition (1h Go change in sibling repo) to the GUI's render logic. Also touches the `onAuthLost` callback contract (signature change in a hook) and adds a new GUI helper module that mirrors an existing auth-side pattern.

## Goals / Non-Goals

**Goals**
- Zero raw engine error messages or CLI-jargon remediation strings surfaced anywhere in the backup pane or restore wizard.
- When the engine retries a chunk, the user sees that it's still progressing (no silent stalls of up to 8 seconds).
- When auth expires mid-operation, the user re-authenticates without losing context — pane state preserved, email pre-filled.

**Non-Goals**
- Auto-resuming a partially-uploaded push after re-auth (manual re-trigger only; partial uploads are not safely resumable without dedicated engine support).
- Surfacing the recovery-key flow from the re-auth modal (covered by Wave 5).
- Refactoring `useBackupState` reducers beyond what D2 + D3 require.

## Decisions

### Decision 1: Sibling emitter method, not extended signature

The engine's `events.Emitter.EmitItem(id, kind, status, ...)` is used by capture and restore code paths in addition to hosted-backup. Adding optional `attempt`/`maxAttempts` parameters would either churn many call sites or introduce a default-value pattern that obscures the contract.

**Choice:** add a sibling `EmitItemRetry(id, kind, attempt, maxAttempts, current, total)` method specifically for retry events. Keeps existing call sites untouched. The emitted JSON event shape includes the same fields the existing `EmitItem` writes plus the retry-specific ones.

**Alternatives considered:**
- Variadic optional struct parameter — Go-idiomatic but awkward at the call sites.
- A separate `RetryEmitter` interface — over-engineered for one method.

### Decision 2: `onAuthLost` callback receives a context object

Current signature is `() => void`. Wave 6 needs the caller (App.tsx) to know which operation triggered the auth-loss (so the re-auth dialog can resume context-appropriately later) and to know the email to pre-fill.

**Choice:** `(ctx: { trigger: 'status'|'list'|'versions'|'push'|'pull'|'delete'|'subscribe'; expectedEmail?: string }) => void`. The argument is an object so future fields can be added without breaking call sites.

**Backward-compat:** the only consumer in-repo is `App.tsx`. The new signature has no required fields the caller must produce — the hook fills `trigger` from its own state and `expectedEmail` from the cached `backupStatusData`.

### Decision 3: Manual re-trigger after re-auth, not auto-resume

Auto-resuming a mid-push after re-auth would require capturing the operation's args + restoring local stream state + safely truncating any partial upload on the server side. That's deep engine work, well outside Wave 6 scope.

**Choice:** re-auth dialog dismisses on success; user clicks Push/Restore again manually. The pane state preservation (delivered by D3) means they don't lose what they were looking at — just one extra click.

**Trade-off:** less magical than "it just works again." Accepted because the safer engineering path matches the explicit Wave 6 scope decision documented in the design-doc clarifying questions.

### Decision 4: Single OpenSpec change covering three deliverables

The three deliverables share a single subsystem (the backup pane), a single PR, and a single capability spec. Splitting into three changes would triple the review and validation overhead without isolating risk — they're interdependent in practice (D3 leans on D1's friendly mapper for the dialog's error states).

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Test-snapshot churn when error-card and toast text changes | Audit `backup-pane.test.tsx`, `restore-wizard.test.tsx`, and any other test asserting on raw engine message strings up front; update assertions to use friendly headlines. |
| `onAuthLost` signature change breaks an unknown consumer | Grep `onAuthLost` across the repo before changing the type; only `App.tsx` should match. Keep callback param object-shaped for forward-compat. |
| Infinite re-auth loop if status refresh fires while dialog is open and returns `AUTH_REQUIRED` again | `reauthOpen` ref in `App.tsx`; `onAuthLost` short-circuits when ref is true. |
| Engine PR with retry event not yet pinned in GUI dev | GUI handles missing `attempt`/`maxAttempts` gracefully — renders generic "Retrying…" copy. GUI PR can land first. |
| Tauri dev-server crash during live verify (`project_tauri_dev_server_crash`) | Live-verify scenarios are short; restart the bridge between scenarios as needed. |
| Different-identity re-auth (user signs in as someone else) silently shows prior list | After successful login inside the dialog, compare returned `email` to `expectedEmail`; if different, clear `backupListData` before refresh. |

## Migration Plan

1. Land D1 first (pure GUI, lowest risk, biggest single UX win — could ship alone if D2/D3 slip).
2. Land D3 — extend `onAuthLost`, add dialog, rewire App.tsx.
3. Land D2 engine side in `endstate` repo; bump engine pin in `package.json` once merged.
4. Land D2 GUI side once engine PR is pinned.
5. Archive this OpenSpec change with `openspec sync-specs` rolling the three ADDED requirements (and the two MODIFIED ones) into `openspec/specs/backup-pane/spec.md`.

No data migration; no breaking API change for end users.

## Open Questions

None at design time. Two were resolved in the design-doc clarifying-questions exchange: retry-visibility scope (chunk progress + visible retry tag) and re-auth scope (modal + manual re-trigger, not auto-resume).
