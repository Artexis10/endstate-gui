## Context

Both defects are one class of bug: activity rows keyed on the wrong or too-narrow identity.

- **Restore duplication**: `App.tsx` mapped each `restore-item` event to an `AppEvent` and *always appended* it (an explicit `// Always append (don't deduplicate restore items by id)`), bypassing the in-place reconciliation that app items use. The row text came from `⚙ ${module}/${id}` where the legacy `id` is the raw `copy:<source>-><target>` spec, and the generic `statusKey` (`installing`/`installed`) rendered through the apply map as INSTALLING/INSTALLED.
- **App-row duplication**: the engine builds `ApplyAction{ID: app.ID, Ref: route.ref}` but streams item events under `route.ref`. `reconcileLiveActivity` matched live rows to envelope actions by `id` only, so for `ref != id` apps the ref-keyed live row and the id-keyed envelope row both survived. Apply + verify run in one spawn, so the surviving live row often showed the verify status while the envelope row showed the apply status.

## Goals / Non-Goals

- Goals: one row per logical item across its whole lifecycle; friendly, engine-named, jargon-free rows; envelope-authoritative final list; raw detail only behind a disclosure.
- Non-Goals: changing engine event shapes; changing the authoritative envelope counts (already correct); redesigning the activity feed layout.

## Decisions

- **Stable identity keying.** Restore rows key on the target path (`⚙ restore:<target>`), constant across `restoring` → terminal, so events reconcile in place via the existing `appEventIndex`. App rows reconcile by an alias map that canonicalises `ref` → action `id`.
- **Display-name resolution tiers** (mirroring the engine's own path derivation): `module` field → `./configs/<module-id>/…` source-path segment → `configSetId` (excluding the anonymous `legacy` lane), each `apps.`-prefix tolerant; then look up the engine display name in `restoreModulesAvailable`. No display name ⇒ `<module-id> · <basename>`. Never the raw copy-spec.
- **Context threading.** The preview envelope's `restoreModulesAvailable`/`configModuleMap` ride along on `ApplyRestoreOptions` so live rows read `Notepad++ · contextMenu.xml` during streaming, not only after the terminal envelope.
- **Single label source of truth.** `getActivityRowLabel(event, phase?)` returns the short label + color for restore (RESTORE_STATUS_MAP), artifact (muted SAVED), and app (phase-aware) rows, so every render site stays consistent.
- **Secondary text.** Friendly canonical strings per skip/failure status; the engine-authored `message` is used when present and free of path/copy-spec markers. Raw `source→target` lives only in the row's hover `title`.
- **Artifact line.** A dedicated `kind: 'artifact'` row ("Saved profile bundle" + filename) replaces the app-style DETECTED row while preserving artifact visibility.

## Risks / Trade-offs

- Threading context via `ApplyRestoreOptions` widens that type; without it rows still degrade to `<module-id> · <basename>` (no jargon), so the fix is robust when context is absent.
- Alias matching adds `ref`→`id` entries; a name-collision risk is avoided by matching only on `id`/`ref`, not display names.

## Migration Plan

Pure presentation change; no persisted state or engine contract changes. Older engines that omit the additive restore fields still resolve via the source-path tier.
