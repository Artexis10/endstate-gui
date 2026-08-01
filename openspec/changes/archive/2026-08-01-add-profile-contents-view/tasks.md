## 1. Model The Manifest The Summary Needs

- [x] 1.1 Extend the existing `ProfileManifest` type in `src/lib/jsonc-parse.ts` with `name`, `captured`, `restore`, and `configCaptures`, and add `displayName` to `ProfileApp`, rather than introducing a second manifest model.
- [x] 1.2 Add the `ProfileModuleSnapshot` shape for the bundle's `provenance/modules/*.json` display names.

## 2. Summarize A Profile Without The Engine

- [x] 2.1 Add `src/lib/profile-contents.ts` deriving app labels, per-module settings tallies, capture timestamp, and disclosure-only module ids from a parsed manifest.
- [x] 2.2 Resolve settings-module labels from the bundle module snapshot, then the owning application, then the capture package ref; reject any candidate equal to the id it describes, mirroring `moduleDisplayNameMap`.
- [x] 2.3 Prefer `configCaptures` over the flat `restore` list when both are present so a manifest-v2 payload is not counted twice.
- [x] 2.4 Read module snapshots best-effort and refuse any snapshot path that does not resolve under `provenance/modules/`.
- [x] 2.5 Cover the summarizer with unit tests: v1 and v2 counting, install-only profiles, unresolvable module ids, echoed-id rejection, snapshot reads, snapshot failure, unsafe paths, and unparseable manifests.

## 3. Present The Summary

- [x] 3.1 Add `ProfileContentsModal` using the shadcn `Dialog`, `Badge`, and `Button` primitives and the existing `DetailsDisclosure`.
- [x] 3.2 Render apps and settings as named regions with counts; keep module ids, manifest version, and path inside **Configuration details**.
- [x] 3.3 Give settings-free and app-free profiles calm explanatory copy rather than warning treatment.
- [x] 3.4 Surface a manifest read or parse failure instead of rendering an empty profile as valid.

## 4. Wire The Affordance Into The Set Up Flow

- [x] 4.1 Add a **What's inside** inline link to each profile card, grouped with the card's other inline links so the Delete/Select action cluster stays a two-button decision.
- [x] 4.2 Stop click propagation so inspecting a profile never selects it or starts a preview.
- [x] 4.3 Cover the wiring with tests: affordance present and named per card, dialog opens for the clicked profile's manifest, and no selection or preview occurs.

## 5. Verify

- [x] 5.1 `npx tsc --noEmit` clean.
- [x] 5.2 `npx vitest run` green — 152 files / 1839 passed before, 155 files / 1874 passed after (2 skipped throughout).
