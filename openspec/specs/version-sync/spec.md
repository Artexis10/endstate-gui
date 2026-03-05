# version-sync Specification

## Purpose

Defines the version synchronization contract across the three GUI version files and the schema compatibility declaration. Ensures version consistency is enforced at development time via pre-push validation.

## Requirements

### Requirement: Three version files must stay in sync

The GUI SHALL maintain identical version strings in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.

#### Scenario: All three files match after bump

- **GIVEN** a version bump is performed via `bump-version.mjs`
- **WHEN** the script completes
- **THEN** the `version` field in `package.json`, the `version` field in `src-tauri/tauri.conf.json`, and the `version` field under `[package]` in `src-tauri/Cargo.toml` all contain the same semver string

#### Scenario: Version sync check passes when in sync

- **GIVEN** all three files contain `0.1.0`
- **WHEN** `check-version-sync.mjs` is run
- **THEN** it exits with code 0

#### Scenario: Version sync check fails on mismatch

- **GIVEN** `package.json` contains `0.2.0` but `tauri.conf.json` contains `0.1.0`
- **WHEN** `check-version-sync.mjs` is run
- **THEN** it exits with code 1
- **AND** prints a clear error identifying which files differ

#### Scenario: Version format validation

- **GIVEN** a version file contains a non-semver string (e.g., `1.0` or `abc`)
- **WHEN** `check-version-sync.mjs` is run
- **THEN** it exits with code 1
- **AND** prints a clear error identifying the invalid format

### Requirement: Pre-push hook validates version sync

The GUI SHALL validate version sync as part of the lefthook pre-push hook.

#### Scenario: Push blocked on version mismatch

- **GIVEN** the three version files are out of sync
- **WHEN** `git push` is attempted
- **THEN** the push is blocked by the version-sync pre-push command

### Requirement: Schema compatibility is declared in code

The GUI SHALL declare its compatible engine schema version range in `src/lib/compat.ts` as a typed constant.

#### Scenario: compat.ts exports ENGINE_SCHEMA_COMPAT

- **GIVEN** `src/lib/compat.ts` exists
- **THEN** it exports `ENGINE_SCHEMA_COMPAT` as a const object with `min` and `max` string fields
- **AND** both fields contain valid `MAJOR.MINOR` format strings

#### Scenario: Schema compat updated via bump script

- **GIVEN** `ENGINE_SCHEMA_COMPAT` has `min: "1.0"` and `max: "1.0"`
- **WHEN** `bump-version.mjs --schema-compat "1.0:2.0"` is run
- **THEN** `compat.ts` is updated with `min: "1.0"` and `max: "2.0"`

### Requirement: Bump script updates all files atomically

The bump script SHALL update all version files and changelog in a single operation, then commit and tag.

#### Scenario: Patch bump

- **GIVEN** current version is `0.1.0`
- **WHEN** `bump-version.mjs patch` is run
- **THEN** all three files are updated to `0.1.1`
- **AND** `CHANGELOG.md` has a new `## [0.1.1]` section prepended
- **AND** a git commit `chore: bump version to 0.1.1` is created
- **AND** a git tag `gui-v0.1.1` is created

#### Scenario: Dry run makes no changes

- **WHEN** `bump-version.mjs patch --dry-run` is run
- **THEN** no files are modified
- **AND** no git commit or tag is created
- **AND** the intended changes are printed to stdout

## Implementation References

- `package.json` — `version` field (source of truth)
- `src-tauri/tauri.conf.json` — `version` field (must match)
- `src-tauri/Cargo.toml` — `version` field under `[package]` (must match)
- `src/lib/compat.ts` — `ENGINE_SCHEMA_COMPAT` constant
- `scripts/bump-version.mjs` — version bump automation
- `scripts/check-version-sync.mjs` — sync validation
- `endstate/docs/SEMVER_SYSTEM.md` — full design specification (in engine repo)
