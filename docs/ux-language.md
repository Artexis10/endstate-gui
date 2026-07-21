# Endstate UX Language & Status Contract

**Status:** Locked  
**Last Updated:** 2026-07-10

This document is the **single source of truth** for status/phase semantics across Endstate GUI and engine. It defines:
- How engine events map to UI labels and colors
- Phase-aware status discrimination rules
- Critical semantic distinctions (MISSING vs FAILED, CANCELLED vs FAILED, etc.)

For the low-level JSONL event schema, see `../endstate/docs/event-contract.md`.

---

## Canonical UI Labels

### Preview (decision states: “what will happen if you apply?”)
- To install
- Already present
- Skipped
- Failed (preview) (optional; only when evaluation fails)

### Apply (activity verbs: “what is happening now?”)
- Installing…
- Skipping…
- Verifying…
- Failed

### Apply (result states: “what happened?”)
- Installed
- Already present
- Skipped
- Cancelled (user denied/cancelled installation)
- Failed

### Verify (result states: "what is the current state?")
- Confirmed (app is installed)
- Missing (app not installed - needs action)
- Failed (verification error)

## Rules

- Preview shows decisions only (no “would”, no in-progress verbs).
- Live activity shows verbs only (in-progress, may include spinners).
- Once an app reaches a terminal state (Installed / Already present / Skipped / Failed / Cancelled),
  it must never show an in-progress verb/spinner again.

---

## Engine Event Schema (Summary)

**Full schema:** See `../endstate/docs/event-contract.md`

### Engine Status Enum

Emitted in `item` events via `status` field:
- `"to_install"` - Preview: will be installed
- `"installing"` - In progress
- `"installed"` - Successfully installed this run
- `"present"` - Already on system (no action needed)
- `"skipped"` - Skipped by filter/policy
- `"failed"` - Failed (reason discriminates type)

### Engine Reason Codes

Emitted in `item` events via `reason` field (nullable):
- `"already_installed"` - App already on system
- `"install_failed"` - Real install failure
- `"missing"` - App not installed (verify phase)
- `"user_denied"` - User cancelled/denied (heuristic, unreliable)
- `"filtered"` / `"filtered_runtime"` / `"filtered_store"` - Excluded by filter
- `"sensitive_excluded"` - Excluded for security
- `"detected"` - Found during capture
- `"manual_required"` - App cannot be auto-installed; needs manual action
- `null` - No specific reason

### Engine Phase Enum

Emitted in `phase` events:
- `"plan"` - Planning (maps to UI "preview" or "apply" depending on context)
- `"apply"` - Executing changes
- `"verify"` - Verifying current state
- `"capture"` - Discovering installed apps

### Capture Progress

Capture is indeterminate: the GUI never invents a percentage or estimates completion from time or item counts. Before the first supported engine stage, the Save flow displays **“Starting capture…”**. Supported capture progress stages use GUI-owned copy:

| Engine stage | GUI copy |
|--------------|----------|
| `inventory` | “Checking installed apps…” |
| `settings` | “Collecting app settings…” |
| `packaging` | “Packaging your setup…” |

Elapsed time is visual-only. At eight seconds the GUI adds: **“Still working — your package manager can take 20 seconds or more on systems with many apps.”** Only stage changes use a polite live region; elapsed seconds are not announced.

Older engines without progress events remain on **“Starting capture…”** until their terminal envelope arrives. Unknown future stage keys are ignored without replacing the last recognized stage.

### Capture Compatibility and Package Sources

The deprecated item status `captured` maps to **Detected** only during capture. Canonical capture items use `status: "present"` with `reason: "detected"`. Unknown item statuses are rejected; they never fall through to **Excluded**.

The engine owns capture source coverage. The GUI invokes ordinary capture without Store include/exclude flags or a Store toggle. An app is labeled **Microsoft Store** only when the engine explicitly reports `source: "msstore"`; the GUI never infers Store identity from a package ID.

Successful capture may include distinct non-fatal warnings:

| Warning code | GUI copy |
|--------------|----------|
| `store_source_unavailable` | “Microsoft Store apps could not be included in this capture.” |
| `winget_source_unavailable` | “Community-repository apps could not be included in this capture.” |
| `store_version_unpinned` | “Affected Microsoft Store apps will restore to the latest available version rather than the exact captured version.” |
| `optional_driver_unavailable` | Not shown in the primary result. Retained in engine output and technical diagnostics. |

Warnings do not hide captured apps, the produced artifact, or the successful result.

---

## GUI StatusKey Enum

Internal UI status keys (canonical filter/logic keys):
- `present` - Already on system
- `to_install` - Will be installed (preview)
- `detected` - Found during capture
- `installing` - In progress
- `installed` - Successfully installed this run
- `skipped` - Skipped by filter/policy
- `failed` - Failed (semantic meaning varies by phase)
- `cancelled` - User cancelled

---

## Canonical Mapping Tables

### Table 1: Engine Status → GUI StatusKey

| Engine Status | GUI StatusKey |
|--------------|---------------|
| `present` | `present` |
| `to_install` | `to_install` |
| `installing` | `installing` |
| `installed` | `installed` |
| `skipped` | `skipped` |
| `failed` | `failed` |

**Note:** Reason codes further discriminate meaning (see Table 2). During
capture, contract status `present` with reason `detected` resolves to the GUI
key `detected`. GUI 2.21.3 also accepts the already-shipped engine 2.24.1
compatibility status `captured` and resolves it to `detected`; this is not a
new engine-contract status.

---

### Table 2: Phase-Aware Status Resolution

**Critical semantic rules** (phase, statusKey, reason) → UI label + color:

#### APPLY Phase

| StatusKey | Reason | UI Label | Color | Meaning |
|-----------|--------|----------|-------|----------|
| `installing` | * | INSTALLING | info (blue) | In progress |
| `installed` | * | INSTALLED | success (green) | Successfully installed |
| `present` | * | PRESENT | success (green) | Already on system |
| `skipped` | `already_installed` | PRESENT | success (green) | Already on system (NOT "Skipped") |
| `skipped` | `user_denied` | CANCELLED | warn (yellow) | User cancelled (NOT "Failed") |
| `skipped` | * | SKIPPED | warn (yellow) | Skipped by filter |
| `skipped` | `manual_required` | MANUAL | warn (yellow) | Requires manual installation |
| `failed` | `install_failed` | FAILED | error (red) | Real install failure |
| `failed` | * | FAILED | error (red) | Unknown failure |

#### VERIFY Phase

| StatusKey | Reason | UI Label | Color | Meaning |
|-----------|--------|----------|-------|----------|
| `present` | * | CONFIRMED | success (green) | App is installed |
| `installed` | * | INSTALLED | success (green) | App is installed |
| `skipped` | `already_installed` | CONFIRMED | success (green) | App is installed |
| `failed` | `missing` | MISSING | warn (yellow) | App not installed (needs action, NOT error) |
| `failed` | * | FAILED | error (red) | Real verification error |
| `to_install` | * | MISSING | warn (yellow) | App not installed |

#### CAPTURE Phase

| StatusKey | Reason | UI Label | Color | Meaning |
|-----------|--------|----------|-------|----------|
| `detected` | * | DETECTED | detected (teal) | Found on system |
| `present` | `detected` | DETECTED | detected (teal) | Found on system |
| `skipped` | `sensitive_excluded` | PROTECTED | warn (yellow) | Excluded for security |
| `skipped` | `filtered*` | EXCLUDED | muted (gray) | Excluded by filter |
| `to_install` | * | NOT FOUND | muted (gray) | Not on system |
| `failed` | * | ERROR | error (red) | Detection failed |

#### RESTORE rows (config settings restored during apply)

Config-restore progress arrives as engine `restore-item` events (see
`../endstate/docs/event-contract.md`, "Restore-Item Event"). These are **settings
rows**, not app rows: they use restore verbs, never the app "INSTALLING" verb.

| Engine restore status | UI Label | Color | Meaning |
|-----------------------|----------|-------|----------|
| `restoring` | RESTORING | info (blue) | In progress (transitional) |
| `restored` | RESTORED | success (green) | Setting file restored |
| `skipped_up_to_date` | UP TO DATE | muted (gray) | Target already matches the saved copy |
| `skipped_missing_source` | MISSING | warn (yellow) | Saved copy not found; nothing changed |
| `failed` | FAILED | error (red) | Restore failed |

**Row presentation (never surface the raw engine copy-spec):**
- **Primary text** = `<module display name> · <target file basename>`, e.g.
  `Notepad++ · contextMenu.xml`. The module display name is the engine-provided
  name resolved from the restore item's module context (`module` field /
  `configSetId` / `captureId` → `restoreModulesAvailable`), or the module id
  derived from the source path `./configs/<module-id>/…` when no display name
  resolves — falling back to `<module-id> · <basename>`. The raw
  `/copy:<source>-><target>` spec is **never** shown inline.
- **Secondary text** (muted) surfaces a friendly, jargon-free reason. The
  engine-authored `message` is used when present and clean; otherwise the
  canonical strings are:
  - `skipped_up_to_date` → “Already matches your saved settings”
  - `skipped_missing_source` → “The saved copy wasn’t found, so nothing changed”
  - `failed` → “Couldn’t restore this file”
- **Full raw source→target detail** may appear only in a hover title /
  disclosure, never as inline row text.
- **One row per item across its lifecycle:** the transitional (`restoring`) and
  terminal (`restored`/`skipped_*`/`failed`) events share a stable identity
  (target path) and **update one row in place** — they never append a duplicate.

#### Produced-artifact completion line

The capture `artifact` event (the saved profile bundle) renders as a distinct,
muted completion line — **SAVED** · “Saved profile bundle”, with the engine
artifact filename as secondary text and the full path in a hover title. It is
**not** an app-style status row and must never read as “DETECTED Manifest”.
Artifact visibility is required (the produced artifact is always surfaced).

---

## Critical Semantic Distinctions

### 1. MISSING vs FAILED (Verify Phase)

**MUST rule:**
- `verify` + `status=failed` + `reason=missing` → **MISSING** (warn, yellow)
- `verify` + `status=failed` + other reason → **FAILED** (error, red)

**Rationale:** Missing apps are not errors—they need installation. Only show red for real verification failures.

**Example:**
```json
{"event":"item","phase":"verify","id":"App.Id","status":"failed","reason":"missing","message":"Missing - not installed"}
```
→ UI displays: **MISSING** (yellow), not FAILED (red)

### 2. CANCELLED vs FAILED (Apply Phase)

**MUST rule:**
- `apply` + `status=skipped` + `reason=user_denied` → **CANCELLED** (warn, yellow)
- `apply` + `status=failed` + `reason=install_failed` → **FAILED** (error, red)

**Rationale:** User cancellation is not a failure—it's intentional. Only show red for real install failures.

**Caveat:** `user_denied` detection is **heuristic and unreliable**. Winget provides no standardized exit code. Some user cancellations may be misclassified as `install_failed`.

**Example:**
```json
{"event":"item","phase":"apply","id":"App.Id","status":"skipped","reason":"user_denied","message":"User cancelled installation"}
```
→ UI displays: **CANCELLED** (yellow), not FAILED (red)

### 3. PRESENT vs CONFIRMED

**MUST rule:**
- `apply` + `present` → **PRESENT** / "Already present"
- `verify` + `present` → **CONFIRMED** / "Confirmed"

**Rationale:** Different phases use different language for the same underlying state.
- APPLY: "Already present" = no action needed (success)
- VERIFY: "Confirmed" = verified installed (success)

### 4. INSTALLED vs CONFIRMED

**MUST rule:**
- **INSTALLED** = app was installed **this run** (apply phase)
- **CONFIRMED** = app is verified present (verify phase)

**Never use "Installed" to mean "verified present".** These are distinct concepts.

---

## Real-World Examples

### Example 1: Verify Missing App

**Engine event:**
```json
{"version":1,"runId":"verify-123","timestamp":"2025-01-05T01:00:00Z","event":"item","id":"Notepad++.Notepad++","driver":"winget","status":"failed","reason":"missing","message":"Missing - not installed"}
```

**GUI displays:**
- Label: **MISSING**
- Color: Yellow (warn)
- Long label: "Missing"
- User meaning: App not installed, needs action

### Example 2: Verify Present App

**Engine event:**
```json
{"version":1,"runId":"verify-123","timestamp":"2025-01-05T01:00:01Z","event":"item","id":"Microsoft.VisualStudioCode","driver":"winget","status":"present","reason":null,"message":"Verified installed"}
```

**GUI displays:**
- Label: **CONFIRMED**
- Color: Green (success)
- Long label: "Confirmed"
- User meaning: App is installed

### Example 3: Apply Install Failure

**Engine event:**
```json
{"version":1,"runId":"apply-456","timestamp":"2025-01-05T01:05:00Z","event":"item","id":"Some.Package","driver":"winget","status":"failed","reason":"install_failed","message":"Installation failed: network error"}
```

**GUI displays:**
- Label: **FAILED**
- Color: Red (error)
- Long label: "Failed"
- User meaning: Real install failure

---

## Scheduled Drift Check Chip (Continuous Protection)

The landing screen's "Save this computer" card renders **at most one** chip,
derived purely from the engine's `schedule status` last-run document. The
mapping is `driftStateFromStatus()` in `src/lib/schedule-bridge.ts` — no drift
computation happens client-side (CLI is source of truth).

### Chip States

| Drift state | Condition (from `schedule status`) | Chip text | Color |
|-------------|-----------------------------------|-----------|-------|
| `drift` | last run verified with `fail > 0` | "N apps drifted since your snapshot" (pluralised) | warn (amber) |
| `failing` | last run recorded a hard `error` | "Drift check failing" | muted (gray) |
| `clean` | last run verified with zero failures | *(no chip)* | — |
| `never-run` | schedule disabled, or no last-run document | *(no chip)* | — |

### Precedence

**MUST rule:** one chip slot, resolved in this order:

1. **Drift** (amber) — engine-reported drift always wins
2. **Drift check failing** (muted)
3. **Scan complete** (transient blue session chip, unrelated to scheduling)

Clean and never-run states render nothing — absence of a chip **is** the
healthy state; there is no "all good" badge.

### Rationale

- Drift is actionable user data; a failing check is diagnostic; both outrank
  the purely cosmetic session chip.
- The failing chip is muted (not red) because a broken scheduled task is not a
  data-loss event — the user's saved capture is intact.
- A disabled schedule maps to `never-run` even when a stale last-run document
  is retained: with no future runs, the retained signal is stale by definition.

---

## Implementation Reference

**GUI code:** `src/lib/apply-utils.ts`
- `UI_STATUS_MAP` - Base status config
- `PHASE_STATUS_MAP` - Phase-specific overrides
- `getPhaseAwareStatusForEvent()` - Canonical resolution function
- `engineStatusToStatusKey()` - Engine → GUI mapping

**Engine code:** `engine/events.ps1`, `engine/apply.ps1`, `engine/verify.ps1`
- `Write-ItemEvent` - Emits item events with status/reason
- `Install-AppViaWinget` - Detects user_denied (heuristic)

---

## Enforcement

### Tests

**GUI:** `src/lib/status-contract.test.ts` (unit tests for critical mappings)
**Engine:** `tests/contract/EventsContract.Tests.ps1` (schema validation)

### Drift Prevention

Changes to status/phase semantics **MUST**:
1. Update this doc (single source of truth)
2. Update `event-contract.md` if JSONL schema changes
3. Update GUI implementation (`apply-utils.ts`)
4. Update engine implementation if event emission changes
5. Update tests to lock new behavior

See `.windsurf/rules/project-ruleset.md` in both repos.

---

## Legacy CLI Mapping (Deprecated)

| Engine / CLI concept | Preview label | Apply result label |
| --- | --- | --- |
| needs_install / planned_install | To install | Installed (if succeeds) / Failed (if fails) |
| already_present / no_op | Already present | Already present |
| skipped / excluded / policy_skip | Skipped | Skipped |
| evaluation_error | Failed (preview) | Failed |

**Note:** Use Table 2 above for authoritative mappings.
