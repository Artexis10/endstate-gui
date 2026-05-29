## Why

The sidecar binary ships to end users without a VERSION file alongside it, so at runtime the engine falls back to reporting "0.0.0-dev" as its version. This means production GUI installs display an incorrect version and cannot validate schema compatibility.

Additionally, production builds (`npm run tauri build`) can silently ship a stale engine if the local engine checkout is behind origin/main, leading to regressions reaching users.

## What Changes

- **Ldflags version embedding**: The rebuild script reads `VERSION` and `SCHEMA_VERSION` from the engine repo root and passes them as Go `-ldflags` during compilation, baking the correct version into the binary at compile time.
- **Staleness guard**: Before building, the script checks whether the local engine repo is behind `origin/main`. In strict mode (`STRICT_ENGINE_BUILD=1`, used by `prebuild`), this is a hard error. In lenient mode (dev), it is a warning. If `git fetch` fails (offline), a warning is printed but the build continues.
- **VERSION file fallback removal**: The script currently falls back to reading a VERSION file if capabilities extraction fails. With ldflags baked in, capabilities always returns the correct version, making this fallback dead code.

## Capabilities

### Modified Capabilities

- `engine-auto-rebuild`: Build script now embeds version via ldflags and includes staleness guard

### New Capabilities

_(none)_

## Impact

- `scripts/rebuild-engine.cjs` — Ldflags added to go build command, staleness guard before build, VERSION fallback removed from version extraction
