## Why

The shipped capture artifact is valid, but the GUI mislabels successful capture events, silently rejects version 2 bundles after reporting import success, and resets to an ambiguous capture screen after Save. These boundary failures make correct engine output look broken and leave users without a clear next action.

## What Changes

- Render successful capture item events as detected, including compatibility with the engine 2.24.1 `captured` status while the engine contract is repaired.
- Accept both version 1 and version 2 manifests during local profile discovery.
- Make ZIP import transactional from the user's perspective: extract, validate, discover, select, and open the imported setup before reporting success.
- Surface import validation/discovery failures instead of silently filtering them.
- Replace the post-save reset with a completion state offering Back to home, Open folder when a native path is known, and Save another copy.
- Add a fast mocked Playwright regression covering capture progress, Save, version 2 ZIP import, and imported-profile selection/preview.
- Retain a slower packaged-installer smoke as a release-only gate.

## Capabilities

### New Capabilities

- `capture-artifact-flow`: User-visible capture progress, durable save completion, and version-compatible ZIP import activation.

### Modified Capabilities

- `final-state-from-envelope`: Clarify that transient capture progress must preserve the engine event's successful meaning while final capture contents remain envelope-owned.

## Impact

- GUI: `src/lib/streaming-events.ts`, `src/lib/apply-utils.ts`, profile validation/discovery, ZIP import orchestration, `SaveFlow`, and focused unit/Playwright tests.
- Engine: capture item-event emission is restored to the existing `present` + `detected` event contract and released independently.
- Release: the GUI hotfix pins the corrected engine and is verified from the public Windows installer before publication.
- No persisted user data or public CLI manifest schema is changed.
