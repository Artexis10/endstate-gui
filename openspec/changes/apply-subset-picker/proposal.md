## Why

The engine now supports `apply --only <id[,id...]>` (engine OpenSpec change `apply-app-subset`, contract section "App-Subset Selection"): the run is filtered to the listed manifest app ids before planning, so drivers, config-module expansion, restore scoping, verification, and summary counts all follow the subset. The GUI needs the consumer half — a per-app picker in the setup flow's preview so the user can install a subset of a profile — while staying a thin presentation layer (no client-side planning; the engine re-plans the subset) and remaining completely dark against engines that do not advertise the flag.

## What Changes

- `src/lib/apply-capabilities.ts` (new, mirrors `backup-capabilities.ts`): `engineSupportsApplyOnly` probe — true only when the capabilities envelope lists `--only` under `commands.apply.flags`; defaults FALSE when unknown
- `src/lib/apply-utils.ts`: pure `buildOnlyFlagValue(ids)` — comma-joins manifest app ids for `--only`, dropping blanks/duplicates and returning null (flag omitted) for an empty selection, so a blank `--only` (engine `MANIFEST_VALIDATION_ERROR`) can never be emitted
- `src/components/app/intent/setup-flow.tsx`: preview-done phase gains capability-gated per-app checkboxes on installable rows (default all checked, reusing the `ConfigModuleSelector` checkbox pattern), an "N of M selected" header with Select all / Select none, client-side re-slicing of the summary counts, Apply disabled at zero selected, and `onApply(profile, { onlyAppIds })` for a strict subset (all-selected omits the field entirely)
- `src/App.tsx`: preview handler surfaces the envelope `data.actions` (manifest `id` + winget `ref`) into the preview result; apply handler appends `--only <ids>` when `onlyAppIds` is present; capability wired at the capabilities handshake and passed to `SetupFlow`

## Capabilities

### New Capabilities

- `apply-subset-picker`: capability-gated per-app selection in the setup flow's preview, translating checkbox state into `apply --only <manifest app ids>` with no client-side planning logic.

### Modified Capabilities

_(none — additive; the preview renders exactly as before when the engine lacks `--only`, and an all-selected apply is byte-identical to today's invocation)_

## Impact

- `src/lib/apply-capabilities.ts` — New: `engineSupportsApplyOnly` probe (+ tests)
- `src/lib/apply-utils.ts` — Modified: `buildOnlyFlagValue` (+ tests)
- `src/components/app/intent/setup-flow.tsx` — Modified: picker state, header affordances, row checkboxes, count re-slicing, Apply gating, subset hand-off (+ tests in `setup-flow-app-picker.test.tsx`)
- `src/App.tsx` — Modified: preview `actions` pass-through, `--only` arg construction, capability handshake + prop
- Undo/revert flow — Untouched
