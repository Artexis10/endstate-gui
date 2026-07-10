# Design: Apply Subset Picker

## Context

Engine ≥ 2.22 (main) accepts `apply --only <id[,id...]>`: manifest apps are filtered before planning, so every downstream stage (plan, drivers, config-module expansion, restore scoping, verify, events, summary counts) behaves as if the manifest contained only the selected apps. Ids are the manifest app `id` values (e.g. `git-git`); unknown or blank selections fail with `MANIFEST_VALIDATION_ERROR`; `--only` + `--prune` is rejected. Capabilities advertise the flag in `commands.apply.flags`. The GUI never passes `--prune`, so no composition guard is needed client-side.

## Decisions

### Dark-by-default capability gate

The picker hangs off `engineSupportsApplyOnly(caps)`, which trusts only the map-shaped `commands.apply.flags` containing `--only` and defaults FALSE (mirrors `engineSupportsIfChanged`). Dark → the preview renders exactly as before: no checkboxes, no selection header, counts straight from the envelope.

### Manifest app id comes from the envelope actions, not the event stream

The preview's rows come from streamed NDJSON item events, which are keyed by the winget `ref` (e.g. `Git.Git`) for winget apps — NOT the manifest `id` that `--only` matches on. The envelope's `data.actions[]` carries both `id` (manifest app id) and `ref`, so the preview handler now passes `actions` through, and the picker maps row → id via `ref` (winget) or `id` directly (manual). Rows that resolve no id render no checkbox (they cannot be targeted by `--only`).

### PRESENT apps stay fully selectable (not locked, not disabled)

Considered: (a) selectable like any row, (b) disabled checkboxes, (c) checked-and-locked. Chosen: **(a) selectable, default checked**, because:

- Unchecking a PRESENT app is harmless for install (nothing to install) but meaningful for scope: the engine's restore scoping follows the subset, so excluding a present app is the user's only way to say "leave this app entirely alone" while still applying the rest.
- A mixed UI (some rows interactive, some locked) needs extra explanatory affordances (lock icon, tooltip) that the existing checkbox pattern (`ConfigModuleSelector`) has no precedent for; uniform checkboxes read clearest.
- Unchecked rows dim to `text-muted-foreground`, the same "not selected" treatment the apply-done view uses for unselected settings.

### Manual/config-only apps are not picker rows; their ids ride along in every subset

The "Settings only" section (driver `manual`: synthesized config-only apps and true manual installs) is governed by the existing restore-intent radio + `ConfigModuleSelector`. Giving those rows picker checkboxes would create two competing selection mechanisms for the same apps. Instead, when a strict subset is applied, ALL ref-less action ids are appended to `--only`, so manual apps and settings composition behave exactly as an unfiltered run. Restore intent therefore composes with the subset with no extra GUI logic: `--restore-filter` still names the user-selected modules, and the engine scopes them to the subset.

### All-selected omits the flag; zero-selected cannot apply

A full selection passes NO `onlyAppIds` (the invocation is byte-identical to today, per the engine spec's "omitting `--only` leaves behavior unchanged"). Zero selected disables the Apply button, and `buildOnlyFlagValue` returns null for an empty list as a second line of defense — the GUI can never emit the blank `--only` the engine rejects.

### Counts re-slice client-side; planning stays in the engine

Unchecking updates the "N to install, M already present" line and the count chips by re-slicing the envelope-reported action statuses over the checked set — pure presentation. The engine re-plans the actual subset on apply; the GUI never computes a plan.

## Alternatives considered

- Re-running `apply --only … --dry-run` on every checkbox change to get engine-truth subset counts: rejected — a winget detect round-trip per click; the preview already carries per-app statuses, and the real subset run re-validates everything anyway.
- Keying selection off streamed event ids and passing winget refs to `--only`: rejected — the engine matches manifest `id` values, not refs; refs would fail validation.
