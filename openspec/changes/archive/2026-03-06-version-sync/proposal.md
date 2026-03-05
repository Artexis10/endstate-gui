## Why

The GUI maintains version strings in three files (`package.json`, `tauri.conf.json`, `Cargo.toml`) that must stay in sync, plus an engine schema compatibility declaration. Without automated validation, version drift can slip through and cause build or runtime failures. A pre-push hook and bump script enforce consistency at development time.

## What Changes

- Add `scripts/check-version-sync.mjs` — validates all three version files match and are valid semver, validates `compat.ts` format
- Add `scripts/bump-version.mjs` — atomic version bump across all three files plus changelog, with commit and tag
- Add `src/lib/compat.ts` — typed `ENGINE_SCHEMA_COMPAT` constant declaring compatible engine schema range
- Add `lefthook.yml` pre-push command for version-sync validation
- Add `CHANGELOG.md` for release history

## Capabilities

### New Capabilities
- `version-sync`: Version synchronization contract across the three GUI version files, pre-push validation, bump automation, and schema compatibility declaration

### Modified Capabilities

_(none)_

## Impact

- `scripts/check-version-sync.mjs` — new file, runs in pre-push hook
- `scripts/bump-version.mjs` — new file, developer workflow tool
- `src/lib/compat.ts` — new file, imported by engine bridge consumers
- `lefthook.yml` — modified to add version-sync pre-push command
- `package.json` — adds `version:check` and `version:bump` npm scripts
- `CHANGELOG.md` — new file, maintained by bump script
