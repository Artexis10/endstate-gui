## Context

The Save flow starts capture with a static “Scanning installed applications…” message. In the July 15 real run, the engine emitted its capture phase immediately but did not emit the first app item for 14.7 seconds; the full run took 22.5 seconds. The scanning card remained visible, but its unchanging copy gave no evidence that the engine had advanced.

The engine contract also permits only canonical item statuses such as `present` and `skipped`. The deployed engine emitted legacy `captured` item statuses, and the GUI's default status mapping classified any unknown value as `skipped`, producing the false **Excluded** label.

This change coordinates with the engine's matching `improve-capture-progress-feedback` change. The GUI remains a presentation layer: the engine owns the current work stage and final results; the GUI owns wording, timing presentation, and accessibility.

## Goals / Non-Goals

**Goals:**

- Make capture visibly active from the moment the user starts it.
- Render truthful engine stages without fake completion percentages.
- Explain a long capture without implying that the app is stuck.
- Work usefully with both new stage-emitting engines and older engines.
- Render legacy capture item status `captured` as detected, never excluded.
- Display Store packages captured by the engine and make partial Store-source coverage visible.
- Keep final outcome and counts envelope-authoritative.

**Non-Goals:**

- Predicting duration or calculating a percentage.
- Inferring engine stages from timers, item counts, or stderr text.
- Selecting, enumerating, installing, or verifying package sources in the GUI.
- Adding a Store-inclusion toggle; complete capture is the engine default.
- Changing runtime filtering.
- Changing generic setup-flow activity panels.

## Decisions

### Consume stage-only progress events

The GUI will add a `ProgressEvent` variant for `event: "progress"`, `phase: "capture"`, and `stage: "inventory" | "settings" | "packaging"`. It will map the stage to UX copy locally. The engine will not send user-facing text.

This keeps business truth in the engine and the UX language system in the GUI. A stage-only event also avoids copy drift between CLI and GUI and remains localizable later. Unknown progress stages will be ignored safely.

### Keep progress indeterminate

Capture has no honest total-work denominator: package-manager enumeration, module matching, file and registry collection, and archive writing vary independently. The progress treatment will therefore use a spinner or indeterminate bar, stage label, and elapsed time, with no percentage.

The stage copy will be:

- `inventory`: “Checking installed apps…”
- `settings`: “Collecting app settings…”
- `packaging`: “Packaging your setup…”

Before the first stage event, including with an older engine, the GUI will show “Starting capture…”. Item events will update activity rows without overwriting the current stage.

### Put the experience in the Save flow

The existing Save-flow scanning card is already visible before the first item. The timer and stage rendering belong in a focused capture-progress component wired into `save-flow.tsx`, rather than changing `LiveActivityPanel`, which is shared with unrelated setup flows.

Elapsed time begins with the user's capture action. At eight seconds the component adds: “Still working — your package manager can take 20 seconds or more on systems with many apps.” The reassurance is presentation-only and does not change the engine stage. The stage label uses `aria-live="polite"`; the per-second timer does not, to avoid noisy announcements. Timers are cleared on success, failure, reset, and unmount.

### Treat legacy status compatibility narrowly

The wire type will accept deprecated `captured` for compatibility, but `itemEventToAppEvent` will translate it to the GUI's `detected` status only during capture. Canonical engines continue to send `present` plus reason `detected`.

The parser will reject item status values outside the canonical set plus the one legacy value. The canonical status mapping will be exhaustive rather than defaulting unknown input to `skipped`. This prevents malformed or future statuses from being presented as deliberate exclusions.

### Inherit complete capture semantics from the engine

The GUI will invoke ordinary capture without adding a hidden `--include-store-apps` flag. The matching engine change makes both `winget` and `msstore` part of capture by default, so GUI and direct CLI capture have identical semantics.

The final envelope remains authoritative. Store apps appear with the engine-reported source `msstore`; the GUI does not infer Store identity from package-ID prefixes. If the engine succeeds with community-repository packages but reports that the Store source was unavailable, the Save result remains successful and shows the engine's non-fatal warning. There is no GUI toggle because Store inclusion is not a user-level capture mode.

Against an older engine, the GUI displays only the packages and warnings that engine actually reports. It does not claim that Store coverage was attempted.

## Risks / Trade-offs

- **[Risk] New GUI with old engine never receives a stage event** → The immediate “Starting capture…” state, elapsed time, and delayed reassurance remain visible for the full run.
- **[Risk] New engine adds another stage** → The parser ignores unknown stages without breaking the run; support can be added intentionally with UX copy.
- **[Risk] Per-second state updates cause announcement noise** → Only the stage copy is live-region content; elapsed time is visually updated but not announced each second.
- **[Risk] An older engine silently omits Store packages** → Do not fabricate coverage; bundled-engine versioning and the paired engine release provide the behavior change.
- **[Risk] Store is disabled by enterprise policy** → Surface the engine's non-fatal warning while preserving the successful community-source capture.
- **[Risk] Dirty `App.tsx` overlaps hosted-backup work** → Keep `App.tsx` edits limited to progress-event state wiring and place rendering/timer logic in the Save-flow component.

## Migration Plan

1. Ship parser and legacy-status compatibility first or alongside the engine; this is safe with older engines.
2. Ship the engine's additive progress events and complete default source behavior; older GUIs ignore the unknown progress event and continue rendering envelope apps.
3. Verify the paired versions with a deliberately delayed first item, a captured Store app, and a Store-unavailable warning.
4. Rollback is version rollback only; no GUI-persisted data migration is involved.

## Open Questions

None.
