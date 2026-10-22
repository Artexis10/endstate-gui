# Endstate UX Language & Status Contract

**Status:** Locked  
**Last Updated:** 2026-10-21

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
| `settings` | “Collecting settings…” (app settings and Windows settings) |
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
| `present` | * | PRESENT | muted (gray) | Already on system; nothing changed |
| `skipped` | `already_installed` | PRESENT | muted (gray) | Already on system (NOT "Skipped") |
| `skipped` | `user_denied` | CANCELLED | warn (yellow) | User cancelled (NOT "Failed") |
| `skipped` | * | SKIPPED | warn (yellow) | Skipped by filter |
| `skipped` | `manual_required` | MANUAL | warn (yellow) | Requires manual installation |
| `failed` | `install_failed` | FAILED | error (red) | Real install failure |
| `failed` | * | FAILED | error (red) | Unknown failure |

In apply and preview, colour marks a change or a problem. An outcome that
changed nothing (PRESENT, and a restore row's UP TO DATE and NOT IN SETUP) is
muted, so the rows that changed or failed stand out in a long list. A filter
chip takes the colour of the rows it filters.

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
`../endstate/docs/contracts/event-contract.md`, "Restore-Item Event"). These are **settings
rows**, not app rows: they use restore verbs, never the app "INSTALLING" verb.

| Engine restore status | UI Label | Long label | Count phrase | Color | Meaning |
|-----------------------|----------|------------|--------------|-------|---------|
| `restoring` | RESTORING | Restoring… | — | info (blue) | In progress (transitional) |
| `restored` | RESTORED | Restored | restored | success (green) | The action changed the target |
| `skipped_up_to_date` | UP TO DATE | Already up to date | already up to date | muted (gray) | Target already has the saved state, or an optional `delete-glob` folder is absent (nothing to delete) |
| `skipped_missing_source` | NOT IN SETUP | Not included in the saved setup | not in saved setup | muted (gray) | An optional settings file the saved setup does not contain; nothing changed |
| `failed` | FAILED | Failed | failed | error (red) | The action could not complete, including a required file the saved setup does not include |

`skipped_missing_source` is neutral: the engine emits it only for an optional
entry whose source the saved setup does not contain (a required entry with a
missing source fails instead). Absence of configuration is not a failure. It is
a different meaning from verify **MISSING** (an app that is not installed),
which keeps its warn mapping.

**Preview (dry run).** The engine keeps the per-item status `restored` in a
preview, where it means the action would change the target; `dryRun` is a
run-level flag. The GUI takes the run's flag (the
envelope's `data.dryRun` once the run ends) and shows preview language, never
RESTORED:

| Engine restore status (dry run) | UI Label | Long label | Count phrase | Color |
|---------------------------------|----------|------------|--------------|-------|
| `restoring` | CHECKING | Checking… | — | info (blue) |
| `restored` | TO RESTORE | Would restore | would be restored | action (blue) |
| other statuses | as above | as above | as above | as above |

**Counts.** Every settings count (settings chip, progress line, result modal)
comes from one source: the reconciled restore rows, one per
target. The apply envelope carries no restore summary, so the GUI never reads
or invents one. A summary lists the non-zero outcomes in table order, e.g.
“4 settings: 1 restored, 1 already up to date, 1 not in saved setup, 1 failed”.
The settings chip shows the row total, adds “(N failed)” when any failed, and
adds the restored count phrase (“restored” or “would be restored”) only when
every row has that outcome. A failed restore makes the run read “Setup
completed with errors”; a preview reads “Preview completed with errors — nothing
was installed”, so it never claims a completed setup.

**Row presentation (never surface the raw engine copy-spec):**
- **Primary text** = `<module display name> · <target file basename>`, e.g.
  `Notepad++ · contextMenu.xml`. The module display name is the engine-provided
  name resolved from the restore item's module context (`module` field /
  `configSetId` / `captureId` → `restoreModulesAvailable`), or the module id
  derived from the source path `./configs/<module-id>/…` when no display name
  resolves — falling back to `<module-id> · <basename>`. The raw
  `/copy:<source>-><target>` spec is **never** shown inline.
- When the engine sends a `label` (the manifest restore entry's human `reason`,
  engine 2.32.0 and later), the label replaces the file basename, for example
  `Windows keyboard: repeat delay and rate · Delay before a held key starts
  repeating`. A registry row (`registry-set` or `registry-import`) without a
  label shows only the module name: its target names a registry key or value,
  and the default UI never shows registry references.
- Under a group heading (for example “Windows settings”) a row with a
  `label` shows the label alone, for example `Keyboard repeat delay`: the
  heading already says what kind of setting it is. Everywhere else the row
  keeps its module name.
- **Secondary text** (muted) appears only on a `failed` row, where it gives the
  reason. Every other status label already says what happened (UP TO DATE,
  NOT IN SETUP, RESTORED), so a restatement only adds noise. The GUI prefers a
  clean engine message (for a `failed` item, its error text). Without one the
  canonical string is “Couldn’t restore this file”. A registry row restores a
  setting, not a file, so it reads “Couldn’t restore this setting”; it always
  uses this canonical string, because its engine message names registry
  internals. A preview or dry run restores nothing, so there the canonical
  string reads “Couldn’t check this file” or “Couldn’t check this setting”.
- **Hover title:** the row's full visible text comes first, because a long row
  truncates. The raw source→target detail follows; it never appears as inline
  row text. A row with no source (`registry-set`) shows only its target. A
  registry row adds the engine message.
- **One row per item across its lifecycle:** the transitional (`restoring`) and
  terminal (`restored`/`skipped_*`/`failed`) events share a stable identity
  (target path) and **update one row in place** — they never append a duplicate.

#### Settings that belong to no app (Windows settings)

A module ID is `<tier>.<name>`. Modules of the `apps` tier, and IDs without a
tier from older engines, hold an app's settings. Modules of any other tier hold
settings that belong to no app; the engine never shows them as an app. The GUI
reads the tier only through `src/lib/settings-kind.ts` and shows these groups:

| Tier | Group heading | One / many | Entry noun |
|------|---------------|------------|------------|
| `windows-settings` | Windows settings | Windows setting / Windows settings | value / values |
| any other non-app tier | Other settings | other setting / other settings | entry / entries |

- **Profile contents:** the group has its own tab and count badge beside Apps
  and App settings. Its rows carry no association line, and they are not
  counted as unidentified app settings.
- **Consent:** the group has its own selector with its own Select all, under
  the heading “<group> to restore:”. Each module shows its entry count with the
  entry noun. Nothing in it is selected by default. The restore filter receives
  the module's full ID.
- **Counts:** in the preview, the setup results and the capture results, a
  count of settings modules names each group apart, for example “40 app
  settings and 7 Windows settings available”; three groups read “a, b and c”.
  A profile with app settings only keeps “40 settings available”. An
  “N settings” filter chip counts the rows that its filter shows: the restore
  rows when the run has any, otherwise the app rows that carry settings. An
  app row carries settings when `configModuleMap` names its package ref, so a
  results row rebuilt under its manifest id still matches.
- **Results:** the group's restore rows list under the group heading, after the
  app rows, each by its label alone. The settings counts still come from all
  restore rows together.
- **Capture results:** the group lists under its own heading, never under
  “Settings only — app installation not included”. Per-module engine notes
  (for example a value not set on this PC) stay behind Details.
- A setup run carries no verify result for these settings: the engine checks
  them only in `verify` and `rebuild`. There, a captured value check that the
  same run did not restore comes back as `status: "skipped"` with
  `reason: "not_restored"`; a standalone `verify` skips every such check. No
  GUI screen renders `verify` result items today (the startup `verify` result
  is stored and never shown), and the scheduled-check drift count reads only
  `summary.fail`, so these skips never count as drift. The GUI therefore has
  no mapping for `not_restored`; add one with the first screen that shows
  verify items.

#### Setup preview and results lists

A long list must still show at a glance what happened and what needs
attention. The preview screen and the results screen (a real run or a dry run)
follow these rules:

- **One place for counts.** The filter chips carry the counts. The results
  header shows only the verdict (“Setup complete”, “Setup completed with
  errors”, “Preview complete — nothing was installed”). A run or a preview
  with no rows has no chips, so its header keeps the app counts. The preview header
  keeps one line about settings (“40 app settings and 7 Windows settings
  available” or “… selected”), because the settings choice sits below a long
  list.
- **Failures first.** A row whose status is an error (FAILED), or one the
  status map marks as needing the person to act (MANUAL), lists under “Needs
  attention”, above the scrolling list and outside it, with its reason. It
  does not repeat in the list below, so every chip still equals the rows its
  click shows, across both places. Other warn outcomes, such as CANCELLED,
  stay in the list. The “N skipped” chip counts every app outcome that is not
  installed, present or failed, so its click shows MANUAL and CANCELLED rows
  too.
- **A failed app keeps a reason.** Its secondary text names what the run tried:
  “Couldn’t install this app” in a real run, and “Couldn’t check this app” in a
  preview or dry run, which install nothing. The engine's message can name
  installer paths, so it appears only in the hover title, as on a registry
  restore row.
- **Quiet rows.** A results row shows the status label and the name, and
  secondary text only on a failure. A results row has no settings icon,
  because the settings rows themselves list under the apps. A preview app row
  keeps the icon: it is the only sign of which apps bring settings.
- The chip row wraps at a narrow width; a chip never breaks its own text.

#### Settings compatibility (setup preview and results)

The engine returns one `configResolutions[]` row for each captured config set.
A long profile returns dozens of rows that carry the same engine label and say
nothing the person can act on. The GUI shows a card only for a row that needs
the person, and folds the other rows into one quiet line. It decides from
`resolution`, `reason` and `status`, never from message text. The preview and
the results use the same rule, and so does the live list while Apply runs
(`src/lib/config-resolution-fold.ts`).

| Row | Shown as |
|-----|----------|
| `reason: ambiguous_target_instance` | Its own card with the target picker, whatever its `resolution` |
| `migrate`, `incompatible` | A card |
| Any row with status `failed`, `rolled_back` or `rollback_failed` | A card |
| Any row, of any kind, whose `reason` is set and is not `target_not_detected`, `already_up_to_date`, `restore_filtered` or `restore_not_enabled` (this includes a new reason) | A card |
| `unknown` with no `reason` | A card |
| `legacy_unverified` with no `reason`, or one of the four reasons above | The quiet line |
| `unknown` with one of the four reasons above | The quiet line |
| `direct` with no `reason`, or one of the four reasons above | A muted “Compatible” line, as before |

The engine reports some failures only as a `reason` on the row, for example
`target_collision`, `app_running`, `backup_failed` or `journal_intent_failed`,
with no terminal status that says “failed” and no later event. Reading the
reason for every kind keeps those rows out of the quiet line and out of the
“Compatible” line.

- **The quiet line is the compatibility notice before Apply.** It shows without
  opening any disclosure. It reads “Compatibility not checked for 40 app
  settings and 7 Windows settings. They were saved before Endstate checked
  versions.” The counts come from the distinct modules in the folded rows, named
  by group as in the counts above. The second sentence claims only what holds:
  “They were saved before…” when every folded row is `legacy_unverified`,
  “N of them were saved before…” when only some are, and no second sentence when
  none is. It is calm and muted, never a warning or a card
  (`ux-guardrails.md`, “Treating Normal Outcomes as Errors”).
- **The section has no heading.** When no row needs the person, the section is
  that one line. When every row needs the person, the section is the cards.
- **Details (preview and results).** With Show details on, the line has a
  “Configuration details” disclosure. It shows each engine label once, each
  engine message once with its remediation, and under each message the settings
  it covers, each with its status and portable provenance. No label or message
  repeats.
- **A failed `direct` row is a card.** A failure is never a quiet confirmation.
- **The live list while Apply runs.** Each `config-resolution` stream event that
  needs the person keeps its row, and every `config-migration` event stays a row.
  The other events fold into one quiet line, counted from the events seen so far,
  with the same copy. This list shows the line alone: it has no details
  disclosure, and the preview and the results keep each folded row's engine copy.
  A stream event carries no status, because the engine emits it before it
  changes the set, so the rule decides from `resolution` and `reason`. The list
  element stays mounted and polite, even when empty, so the first row that
  needs the person is announced. The quiet line sits outside it, so a screen
  reader does not announce each count change.

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
- APPLY: "Already present" = no action needed (muted: nothing changed)
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

## Scheduled Setup Checks Chip

The landing screen's "Save this computer" card renders **at most one** chip,
derived purely from the engine's `schedule status` last-run document. The
mapping is `driftStateFromStatus()` in `src/lib/schedule-bridge.ts` — no drift
computation happens client-side (CLI is source of truth).

### Chip States

| Drift state | Condition (from `schedule status`) | Chip text | Color |
|-------------|-----------------------------------|-----------|-------|
| `drift` | last run verified with `fail > 0` | "N apps drifted since your snapshot" (pluralised) | warn (amber) |
| `failing` | last run recorded a hard `error` | "Drift check failing" | muted (gray) |
| `capture-pending` | additive `lastRun.status` is `running` or an unknown non-empty value | "Setup check in progress" | muted (gray) |
| `upload-pending` | pending upload with no more specific outcome | "Upload pending" | muted (gray) |
| `sign-in-required` | upload outcome `auth_required` | "Sign in required to upload" | warn (amber) |
| `subscription-required` | upload outcome `subscription_required` | "Subscription required to upload" for Endstate Cloud; neutral configured-service restriction otherwise | warn (amber) |
| `setup-required` | upload outcome `setup_required` | "Open Endstate Cloud and save your first Cloud version" for managed accounts; neutral initial-version guidance otherwise | warn (amber) |
| `upload-uncertain` | upload outcome `upload_uncertain` | The service may have saved the version; check it or save a new version manually. Automatic retry is paused to avoid duplicates. | warn (amber) |
| `upload-failed` | upload outcome `error` | "Upload failed" | muted (gray) |
| `offline` | upload outcome `offline` | "Offline — local version saved; uploads will retry" | muted (gray) |
| `local-only` | older engine omits upload truth | "Saved locally only" | muted (gray) |
| `clean` | last run verified with zero failures | *(no chip)* | No chip is not a claim that protection is current; it only means no actionable schedule result is available. |
| `never-run` | schedule disabled, or no last-run document | *(no chip)* | No chip is not a healthy-state claim. |

### Precedence

**MUST rule:** one chip slot, resolved in this order:

1. **Setup check in progress** — a running or unknown engine run marker invalidates all retained prior results
2. **Setup required / upload uncertain** — terminal transfer truth from the capture triggered by drift wins over the retained drift count
3. **Drift** (amber) — engine-reported drift wins over ordinary retryable upload attention
4. **Drift check failing** (muted)
5. **Scan complete** (transient blue session chip, unrelated to scheduling)

Clean and never-run states render nothing. Absence of a chip is deliberately
not a healthy or current-protection claim; there is no "all good" badge.

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
