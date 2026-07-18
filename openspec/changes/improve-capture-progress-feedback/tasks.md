## 1. Lock the GUI contracts with failing tests

- [x] 1.1 Add parser tests for supported capture progress stages and safe rejection of unknown stages.
- [x] 1.2 Add status-mapping tests proving legacy capture `captured` and canonical `present`/`detected` render as **Detected**, while malformed statuses never render as **Excluded**.
- [x] 1.3 Add Save-flow progress tests for immediate zero-item feedback, stage changes, elapsed time, the eight-second reassurance, accessibility, and timer cleanup.
- [x] 1.4 Add capture-result tests for engine-reported `msstore` apps and all non-fatal source/Store-portability warning codes.

## 2. Parse and map engine events

- [x] 2.1 Add `ProgressEvent` and capture-stage types, type guard, union membership, and parser validation in `src/lib/streaming-events.ts`.
- [x] 2.2 Accept deprecated `captured` on the wire and translate it only for capture activity in `src/lib/apply-utils.ts`.
- [x] 2.3 Replace the unknown-status-to-skipped fallback with exhaustive canonical mapping and parser rejection.

## 3. Render truthful capture progress

- [x] 3.1 Add a focused capture-progress component with indeterminate activity, GUI-owned stage copy, elapsed time, delayed reassurance, and a polite stage live region.
- [x] 3.2 Wire the component into `src/components/app/intent/save-flow.tsx` so it is visible before any item event and resets cleanly on terminal states.
- [x] 3.3 Update `src/App.tsx` to initialize fallback progress, consume engine progress events, and preserve the current stage when item events arrive.

## 4. Render complete capture results

- [x] 4.1 Preserve and display the engine-reported `msstore` source in capture activity/details without inferring it from package IDs.
- [x] 4.2 Surface `store_source_unavailable`, `winget_source_unavailable`, and `store_version_unpinned` distinctly while keeping the successful capture result intact.
- [x] 4.3 Confirm the GUI invokes ordinary capture without a Store-specific include flag or toggle.
- [x] 4.4 Keep `optional_driver_unavailable` in engine diagnostics but omit it from the primary capture-result warnings.

## 5. Document and integrate

- [x] 5.1 Update `docs/ux-language.md` with capture stage copy, slow-operation reassurance, legacy `captured` compatibility, and Store warning language.
- [x] 5.2 Add a streaming-runner or bridge fixture that delays the first item while emitting progress stages and includes an `msstore` app.
- [ ] 5.3 Verify paired behavior through the live bridge for the complete source set, Store-unavailable warning, and old-engine/no-progress fallback.

## 6. Verification

- [x] 6.1 Run targeted Vitest suites for streaming events, status mapping, Save flow, Store-result visibility, and App capture wiring.
- [x] 6.2 Run type checking and the repository's required validation commands.
- [x] 6.3 Perform an independent reviewer/verifier pass and resolve findings without touching unrelated hosted-backup or generated Tauri-schema changes.
