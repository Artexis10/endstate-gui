## Context

Engine 2.24.1 produces valid version 2 capture bundles, but the GUI has three stale boundaries. Its streaming status union omits the engine's temporary `captured` status and maps unknown values to `skipped`; its duplicated Rust profile validators accept only version 1; and Save clears the capture result immediately after the file dialog succeeds. ZIP extraction is currently reported as success before semantic validation or discovery, so a rejected profile looks imported even though it cannot be used.

The engine's existing event contract already requires capture items to use `present` with reason `detected`. Final capture contents remain owned by the command envelope. The GUI must be robust against the already-shipped 2.24.1 event while the engine restores the contract.

## Goals / Non-Goals

**Goals:**

- Preserve truthful successful capture progress across the engine/GUI boundary.
- Make version 1 and version 2 bundle manifests discoverable without weakening structural validation.
- Treat import as complete only when the imported profile is validated, discovered, selected, and visible in the setup flow.
- Give native Save a clear completion state and next actions.
- Catch the complete user-visible regression cheaply on every GUI PR.
- Verify the real engine and packaged installer at release time.

**Non-Goals:**

- Change the version 2 manifest format or restore semantics.
- Infer final app/config contents from streaming events.
- Add recursive arbitrary-depth profile discovery.
- Automatically execute Apply after import.
- Store a second copy of a user's imported ZIP outside the established profiles directory.

## Decisions

### Restore the engine contract and keep a compatibility adapter

The engine will emit `status: "present"` and `reason: "detected"` for captured package items, as its contract and existing OpenSpec already require. The GUI will additionally recognize `status: "captured"` as a successful detected event so GUI 2.21.3 remains compatible with engine 2.24.1 and any cached/dev binary.

Changing only the GUI was rejected because it would leave other consumers exposed to an off-contract engine. Changing only the engine was rejected because existing installations and dev binaries already emit `captured`.

### Validate supported manifest versions at the shared Rust boundary

Both production Tauri and the browser bridge will accept manifest versions 1 and 2, while preserving object/apps validation. Tests will exercise both validators with the same fixtures to prevent their duplicated implementations drifting again.

Delegating version 2 validation to the external engine for every profile listing was rejected: discovery is a local, frequent operation and the GUI already owns a pure structural validator. Removing validation was rejected because invalid files must not become selectable profiles.

### Make import an explicit outcome, not an optimistic toast

Extraction returns its destination directory. The frontend refreshes discovery, locates the manifest under that exact directory, and only then reports success. It selects the discovered profile and routes the setup flow to its existing review/preview surface. If discovery cannot produce a profile, import reports a concrete error and does not claim success.

Automatically executing Apply was rejected because setup execution must remain an explicit user action. Merely adding a profile card was rejected because the user's intent after choosing a file is to inspect/use that imported setup now.

### Preserve capture state after Save

`onSaveToFile` will return a structured outcome containing whether a save occurred and, for native saves, the durable path. SaveFlow will move to a `saved` state instead of clearing its result. The completion surface offers Back to home as the primary action, Open folder when a native path is known, and Save another copy. Browser downloads omit Open folder because the browser does not reveal a stable path.

Automatic timed navigation was rejected because it hides confirmation and can disorient users. Keeping the scan result screen unchanged was rejected because it provides no clear completion or next action.

### Use a two-tier regression suite

A tiny mocked v2 ZIP/manifest fixture and semantic NDJSON events drive a Playwright test through capture progress, Save, import, discovery, selection, and setup preview. This stays fast by mocking winget, filesystem transport, and engine process work at their existing bridge seams while exercising real React routing/state.

Engine unit/contract tests verify the exact capture event vocabulary. A packaged public-installer smoke remains release-only and runs the extracted engine plus the v2 import boundary. Running a real winget capture in every PR was rejected as slow, stateful, and vulnerable to winget locks.

## Risks / Trade-offs

- **Two Rust validators can drift again** → feed identical v1/v2/unsupported fixtures through both implementations in contract tests; follow-up deduplication is out of scope.
- **Import selection races profile refresh** → identify the imported manifest by the extraction directory returned from Rust, not by filename or array ordering.
- **A malicious ZIP can escape its directory** → retain the existing traversal protections and add no new extraction behavior.
- **The compatibility `captured` status can become permanent debt** → document it as compatibility for engine 2.24.1 and keep the engine contract test authoritative.
- **Playwright mocks can diverge from shipping artifacts** → release gate still audits and smokes the actual installer and exact public bundle.

## Migration Plan

1. Release the engine event-contract repair as a patch.
2. Pin that engine patch in the GUI hotfix while retaining compatibility with 2.24.1.
3. Run unit, Rust, contract, and fast Playwright tests.
4. Build signed MSI/NSIS artifacts, audit packaged resources, and run the real artifact smoke.
5. Publish only after import and capture-save checks pass; rollback by leaving the release draft/unpublished if any gate fails.

## Open Questions

None. The user approved the cross-repo repair, automatic imported-profile review, and explicit post-save completion state.
