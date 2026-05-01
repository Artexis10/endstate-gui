# Change: Pin engine version via ENGINE_VERSION file

## Why

The current CI build checks out the endstate engine source repo and compiles the Go binary from scratch, making the bundled engine version implicit (determined by whichever commit ENGINE_REF pointed to at build time) and tying every GUI release to Go toolchain availability and a multi-minute compile step. Replacing the source build with an explicit `ENGINE_VERSION` file and a pre-built binary download makes the build reproducible, faster, and auditable.

## What Changes

- Add `ENGINE_VERSION` file at repo root containing a single semver string (e.g. `1.7.7`); this becomes the single source of truth for which engine ships in each GUI release
- Add `ENGINE_VERSION` to `release-please-config.json` `extra-files` so it is tracked in the manifest but NOT auto-bumped
- Remove the `mklink /J` junction creation step from the CI workflow (Windows-only complexity, required only because `tauri.conf.json` referenced a path outside the workspace)
- Remove the Go toolchain setup and `go build` step from CI
- Remove `SKIP_ENGINE_BUILD: '1'` from the Tauri build step (no longer needed once the binary is pre-placed)
- Add a "Acquire engine binary" step to CI that: reads `ENGINE_VERSION`, verifies the GitHub Release exists, downloads `endstate.exe` + `endstate.exe.sha256`, verifies the SHA-256 checksum (hard-fail on mismatch or missing file), and places the binary at the Tauri sidecar path
- Update `tauri.conf.json` `externalBin` from the junction-relative path `../../endstate/go-engine/endstate` to the standard in-workspace sidecar path `binaries/endstate`; update resource paths from `../../endstate/` to `../endstate/` (engine repo is still checked out shallowly in CI for modules/VERSION/SCHEMA_VERSION)
- Update `rebuild-engine.cjs` to auto-detect a pre-placed sidecar binary and skip the Go build when it exists, preserving local-dev source-build for developers with Go installed
- Add a CI guard that fails the build early if ENGINE_VERSION does not correspond to an existing GitHub Release

## Capabilities

### New Capabilities

_(none — this change modifies existing capabilities only)_

### Modified Capabilities

- `engine-bundling`: how the engine binary is acquired at build time changes from source-compile to release-download; sidecar path and `tauri.conf.json` references change
- `auto-release`: CI workflow steps change (remove junction + Go build, add binary download + checksum verification)

## Impact

- **`.github/workflows/release-please.yml`** — remove Go toolchain setup, Go build, junction step; add engine binary download + checksum step; remove `SKIP_ENGINE_BUILD` env var from Tauri action step
- **`tauri.conf.json`** — update `externalBin` and resource paths (removes junction dependency)
- **`scripts/rebuild-engine.cjs`** — add pre-placed binary detection so local dev still works without SKIP_ENGINE_BUILD
- **`ENGINE_VERSION`** (new file) — sole pin for engine release version
- **`release-please-config.json`** — add `extra-files` tracking
- **No runtime behavior change** — the bundled engine binary and its invocation path remain identical from the GUI's perspective
