# Capture-to-undo golden journey

## Goal

Prevent a release from shipping when the GUI's connected portable-backup journey is broken even though its individual capture, save, import, restore, and undo tests still pass.

## Design

Add one deterministic Playwright journey to the existing capture artifact regression suite. It will:

1. Capture a fixture containing one application and one settings module.
2. Save the generated ZIP through the same browser download path a user invokes.
3. Upload those exact downloaded bytes into the setup flow.
4. Require import validation and a successful dry-run preview before import success is shown.
5. Apply with settings restore enabled and verify the restore result is rendered.
6. Run undo dry-run, confirm undo, execute it, and verify completion.

The semantic Tauri/engine fixture will be stateful enough to reject out-of-order or disconnected operations. It will record the captured artifact bytes, validate that import receives those bytes, expose the imported manifest, require the imported manifest path on preview/apply, create an in-memory restore journal on live apply, and require that journal before undo can succeed.

## Safety and cost

The Playwright journey uses deterministic in-memory engine and filesystem boundaries. It performs no package installation, network access, host filesystem restore, or machine-specific scan, satisfying the GUI integration-test contract. It runs inside the existing Linux Playwright job on every pull request, so it adds no Windows bundle build and no billable runner requirement for this public repository.

The existing Windows packaged-engine smoke remains responsible for the real released binary, module catalog, and installer boundary. Extending that smoke through live restore and revert is useful only if it can remain hermetic and confined to temporary directories.

## Acceptance criteria

- One Playwright test traverses capture, save, import, preview, live apply, and undo without resetting the page or fixture state.
- The test proves the imported bytes came from that journey's capture output.
- The test proves live apply enables settings restore for the imported manifest.
- Undo cannot report success unless the journey produced a restore journal.
- Existing capture artifact and CI policy tests remain green.
