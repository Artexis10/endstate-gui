## Context

The current intent-based UI and engine contract are sound: Capture creates the portable artifact, Setup previews and applies it, configuration restore is off by default, and the engine owns compatibility decisions. The confusion is at the presentation and state-transition boundaries.

Capture currently mixes installable application rows, settings indicators, and settings-only rows without explaining ownership. Setup renders restore-disabled `configResolutions[]` as a long series of skipped compatibility cards even though the user has not enabled restore. Selecting the restore option changes local presentation state but does not request a matching engine preview. Finally, the recently repaired import path couples transactional import success to automatic preview, and two native drag listeners split visual state from import execution. The DropZone listener also uses a Tauri v1-only runtime heuristic while the packaged Tauri v2 app exposes `__TAURI_INTERNALS__`.

The GUI remains a thin presentation and invocation layer. It must not infer installability, compatibility, migration, or restore outcomes. The engine already supports restore-enabled dry runs, so no engine, manifest, or envelope change is required.

## Goals / Non-Goals

**Goals:**

- Preserve the current Capture → Setup flow and visual design while making application, installer, and settings ownership legible.
- Make import completion and setup preview two explicit, independently reportable states.
- Ensure the preview shown in Setup matches the user's visible restore intent.
- Restore reliable browser and packaged-Tauri drag feedback with exactly-once import execution.
- Protect the complete mocked capture/save/import/review/apply/undo journey and the native drag lifecycle in pull-request tests.

**Non-Goals:**

- Redesign the landing screen, cards, navigation, color system, or overall information architecture.
- Enable configuration restore by default or persist restore consent.
- Teach the GUI package ownership or compatibility rules.
- Change the capture bundle, profile, CLI envelope, or engine behavior.
- Run real winget installs or mutate a developer machine in pull-request Playwright tests.

## Decisions

### 1. Clarify the existing sections instead of introducing a new mode

Capture keeps its current result card and lists, but names the concepts directly: **Apps found on this PC**, **Settings captured**, and **Settings only — app installation not included**. Short supporting copy explains that the main app entries are included for setup. The existing settings glyph receives an accessible legend such as **Settings captured for this app**. Setup uses the same ownership language for settings-only entries and explains that Endstate can restore their settings but the profile does not include an installer.

This retains the design the user already likes and makes the distinction learnable in place. A copy-only patch was rejected because it would leave the state-transition and stale-preview bugs intact. A new wizard or settings mode was rejected because it would fragment the two-intent architecture.

### 2. Import ends at a visibly discovered profile

Transactional staging, validation, atomic commit, and exact-path discovery remain unchanged. After discovery, App records the exact imported profile as `recentlyImported` and reports import success. Setup stays on its profile list, brings that card into view, adds a one-shot **Imported** badge, and exposes a primary **Review setup** action. No preview promise or engine invocation is part of import completion.

Activating **Review setup** follows the existing profile-selection preview path and starts exactly one dry run. A later preview failure is displayed as a preview failure while the already committed profile remains available. The shipped `fix-capture-save-import-flow` delta is first synced into the canonical `capture-artifact-flow` spec, and this change formally removes and replaces its automatic-activation requirement while retaining that change's safe import boundary.

### 3. Preview results are associated with restore intent

`SetupFlow.onPreview` gains presentation-level preview options rather than creating new engine semantics. App maps `apps-only` to `apply --profile <path> --dry-run` and `apps-and-settings` to the same command plus `--enable-restore`.

A profile first opens with `apps-only`. The result displays application actions and a single engine-count-backed callout when settings are available. It does not display individual restore-disabled config-resolution rows.

When the user selects **Install apps and restore settings**, Setup clears any config-resolution UI that belongs to the install-only preview, displays a checking state, disables Apply, and requests a fresh restore-enabled dry run. Only that result can populate compatibility rows, module approval, and target mappings. Module and target selections reset when their source preview changes; compatible application picker selections are preserved by stable application ID. Switching back to install-only also requests a fresh install-only dry run, clears restore consent, and keeps Apply disabled until the new result arrives. No earlier result is resurrected after another invocation.

Every preview receives a monotonically increasing request generation in addition to `{ profilePath, restoreIntent }`. Setup commits a result only when all three values match the active request, so an older retry or cancelled same-key request cannot overwrite a later result. The existing one-run-at-a-time guard remains the execution authority; controls avoid issuing a second preview while one is active, while the generation check still protects reset, cancellation, rejection, and retry boundaries.

### 4. Summaries may simplify engine data; compatibility may not

The GUI may count engine-provided settings modules and say, for example, **45 settings are available but won't be restored**. This is availability and current intent, not a compatibility judgment. Once restore is enabled, the GUI renders engine-authored resolution labels, messages, remediation, targets, and status without rewriting or guessing.

This conditional disclosure replaces the current misleading list of **Settings restore is not enabled for this invocation** cards while preserving the engine as the sole source of compatibility truth.

### 5. One top-level owner handles native drag lifecycle

App owns the Tauri `enter`, `over`, `leave`, and `drop` lifecycle using the shared `isTauriRuntime()` detector. It filters supported extensions once, drives a controlled drag-acceptance state, routes a valid drop to Setup, and acquires the existing import lease before processing every supported path exactly once in the order supplied by the event. The most recently committed profile keeps the one-shot emphasis. DropZone continues to own browser HTML5 events but receives the native acceptance state for its existing scale/color/text treatment. When the Setup drop zone is not mounted, a lightweight app-level overlay uses the same visual language so landing-page drops still have feedback.

Unsupported paths never show an acceptance state. Leave, accepted drop, rejected drop, cancellation, and unmount clear it. The DropZone's separate native listener and private Tauri detector are removed to prevent duplicate listeners and divergent state.

### 6. Test the semantic journey and native boundary separately

Component tests cover exact labels, accessible explanations, import highlighting, no implicit preview, restore-intent reruns, stale-result suppression, and preserved app selection. Native-drop tests simulate Tauri v2 using `__TAURI_INTERNALS__` and exercise enter/over/leave/drop plus the import lease. Playwright uses a real browser `DataTransfer` event for hover/drop presentation and the semantic bridge for the connected capture → save → import → Review setup → both preview intents → apply → undo journey.

The connected journey stays deterministic and cheap by mocking filesystem transport and engine process work at existing seams. Existing Windows installer/package gates remain responsible for proving the packaged engine boundary; they do not replace the interaction tests.

## Risks / Trade-offs

- **A restore-intent change adds an engine dry run** → Keep the initial safe preview, run only on explicit opt-in, disable repeated controls while active, and retain the one-run-at-a-time guard.
- **An older or retried preview resolves after a newer request** → Tag every request with profile, intent, and a monotonically increasing generation; commit only the exact active generation.
- **A fresh settings preview could reset app curation** → Reconcile selected application IDs against the new result instead of resetting all selections.
- **Browser and native drop paths could both fire** → Use one import coordinator/lease and only one native listener; browser DropZone remains independent in non-native execution.
- **A recently imported marker could become stale after refresh** → Key it by the exact committed manifest path and clear it after explicit review, another import, deletion, or flow reset.
- **Conditional config disclosure could hide useful errors** → Hide only restore-disabled config rows; general preview errors and restore-enabled engine-authored resolutions remain visible.

## Migration Plan

1. Sync both shipped `fix-capture-save-import-flow` deltas into canonical `capture-artifact-flow` and `final-state-from-envelope` specs without archiving its unverified release checklist, then validate this change as a real delta against `capture-artifact-flow`.
2. Land the GUI behavior and regression tests without changing persisted profile data or engine contracts.
3. Run focused unit tests, the connected Playwright journey, the broader GUI verification suite, and the existing Windows packaging checks.
4. Independently verify the older hotfix's outstanding tasks, then archive it first with `openspec archive fix-capture-save-import-flow --skip-specs`; its deltas are already canonical, so skipping spec application prevents duplicate additions and cannot restore the superseded automatic-preview contract.
5. Ship through the normal patch-release path so newly downloaded MSI and NSIS installers contain the repaired GUI.
6. Roll back by reverting this GUI change; imported profiles and capture bundles require no data migration.

## Open Questions

None. If implementation shows that the current engine cannot produce a restore-enabled dry run with its existing flag, stop and propose that engine contract change separately rather than adding compatibility logic to the GUI.
