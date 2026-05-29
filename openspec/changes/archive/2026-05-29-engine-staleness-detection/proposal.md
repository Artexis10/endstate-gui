## Why

When developing the GUI against a bootstrapped copy of the engine, there is no visibility into whether the engine is stale. Developers may spend time debugging issues caused by running an outdated engine copy. The engine is adding `gitCommit`, `gitDirty`, and `bootstrapTimestamp` fields to its capabilities envelope — the GUI should surface these in dev mode.

Additionally, the dev server should automatically re-bootstrap the engine before starting, ensuring the latest engine code is always available during development.

## What Changes

- Add optional `gitCommit`, `gitDirty`, and `bootstrapTimestamp` fields to `EndstateCapabilitiesData` type
- In dev mode, log engine version info to console after capabilities handshake
- Warn in dev mode if `gitCommit` is null (likely stale bootstrapped copy)
- Add a `predev` npm script that re-bootstraps the engine before `tauri dev`

## Capabilities

### New Capabilities

- `engine-staleness-detection`: Dev-mode console logging of engine version info with staleness warning

### Modified Capabilities

_(none)_

## Impact

- `src/types.ts` — Extended `EndstateCapabilitiesData` with version fields
- `src/App.tsx` — Dev-mode console logging after capabilities handshake
- `package.json` — New `predev` script for automatic re-bootstrap
