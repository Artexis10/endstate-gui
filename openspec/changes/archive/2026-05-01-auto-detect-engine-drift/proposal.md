# Change: Auto-detect engine drift and open bump PR

## Why

`ENGINE_VERSION` is pinned manually — when the engine ships a new release, someone has to remember to update the file, open a PR, and keep the two repos in sync. This creates invisible drift: the GUI quietly ships an older engine until a human notices. A daily scheduled workflow closes the gap by detecting drift automatically and opening a `feat:` PR, making the bump visible and keeping release-please in the loop.

## What Changes

- Add `.github/workflows/engine-drift-check.yml` — daily schedule + `workflow_dispatch`; reads `ENGINE_VERSION`, queries the latest published engine release, compares with proper semver (not string), opens a bump PR when drift is detected
- PR title uses `feat:` prefix so release-please counts it as a minor-version bump on merge
- PR body includes a link to engine release notes, commit list since last pin, and a `⚠ Major version bump` warning when the major component changes
- Guard: skip PR if the latest release lacks `endstate.exe` / `endstate.exe.sha256` assets (incomplete release)
- Guard: idempotent — re-running when a bump PR already exists does nothing
- Add an engine-pin badge to `README.md` showing the currently pinned version

## Capabilities

### New Capabilities

- `engine-drift-detection`: scheduled CI detects when the pinned engine version is behind the latest published release and opens an automated bump PR

### Modified Capabilities

_(none — no existing spec-level behavior changes)_

## Impact

- **`.github/workflows/engine-drift-check.yml`** (new) — the drift detection workflow
- **`README.md`** — add engine-pin status badge
- No changes to runtime behavior, build logic, or existing workflows
