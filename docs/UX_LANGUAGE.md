# Endstate UX language contract

This document defines the canonical UI language for preview/apply flows and how it maps to CLI/engine terms.

## Canonical terms

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
- Failed

## Rules

- Preview shows decisions only (no “would”, no in-progress verbs).
- Live activity shows verbs only (in-progress, may include spinners).
- Once an app reaches a terminal state (Installed / Already present / Skipped / Failed),
  it must never show an in-progress verb/spinner again.

## CLI → GUI mapping

| Engine / CLI concept | Preview label | Apply result label |
| --- | --- | --- |
| needs_install / planned_install | To install | Installed (if succeeds) / Failed (if fails) |
| already_present / no_op | Already present | Already present |
| skipped / excluded / policy_skip | Skipped | Skipped |
| evaluation_error | Failed (preview) | Failed |
