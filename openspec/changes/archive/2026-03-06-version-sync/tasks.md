## 1. Version Sync Check Script

- [x] 1.1 Create `scripts/check-version-sync.mjs` that reads versions from `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`
- [x] 1.2 Validate all versions are valid semver (`X.Y.Z` format), exit 1 with clear error on invalid format
- [x] 1.3 Compare all three versions, exit 1 with error identifying which files differ on mismatch
- [x] 1.4 Validate `src/lib/compat.ts` exports `ENGINE_SCHEMA_COMPAT` with valid `MAJOR.MINOR` format for `min` and `max`

## 2. Schema Compatibility Declaration

- [x] 2.1 Create `src/lib/compat.ts` exporting `ENGINE_SCHEMA_COMPAT` as const with `min` and `max` string fields

## 3. Bump Version Script

- [x] 3.1 Create `scripts/bump-version.mjs` with `readVersion()` from `package.json` (source of truth)
- [x] 3.2 Implement semver parsing and bump logic for `patch`, `minor`, `major` types
- [x] 3.3 Implement atomic write to all three version files (`package.json`, `tauri.conf.json`, `Cargo.toml`)
- [x] 3.4 Implement changelog prepend (insert new `## [version]` section before first existing section)
- [x] 3.5 Implement git commit (`chore: bump version to X.Y.Z`) and tag (`gui-vX.Y.Z`)
- [x] 3.6 Implement `--dry-run` flag that prints intended changes without modifying files
- [x] 3.7 Implement `--schema-compat "min:max"` flag to update `compat.ts`
- [x] 3.8 Implement `--set x.y.z` flag for explicit version setting

## 4. Pre-push Hook Integration

- [x] 4.1 Add `version-sync` command to `lefthook.yml` pre-push section running `node scripts/check-version-sync.mjs`
- [x] 4.2 Add `version:check` npm script to `package.json`

## 5. Changelog

- [x] 5.1 Create initial `CHANGELOG.md` with `## [0.1.0]` section

## 6. Verification

- [x] 6.1 Run `node scripts/check-version-sync.mjs` and confirm exit 0
- [x] 6.2 Run `node scripts/bump-version.mjs patch --dry-run` and confirm correct output without file changes
