## ADDED Requirements

### Requirement: Every pull request reports stable regression checks

The repository SHALL run production web checks, frontend tests, pinned-engine contract checks, locked Rust core/dependency checks, semantic end-to-end tests, the engine-pin check, and an always-reported bundle gate for every pull request to `main`.

#### Scenario: Ordinary pull request
- **WHEN** a pull request targets `main`
- **THEN** every required regression-check context SHALL report a terminal result
- **AND** superseded runs for the same pull request SHALL be cancelled

### Requirement: Windows installer verification is conditional and fail-closed

The bundle gate SHALL run the real MSI and NSIS build, content audit, and packaged-engine smoke test for manual requests and packaging-sensitive changes. It SHALL skip that Windows job only when a complete classification proves the change unrelated or proves the pull request is an uncontaminated Release Please version update covered by the signed draft-release gate.

#### Scenario: Packaging-sensitive change
- **WHEN** a pull request changes a packaging-sensitive current or previous rename path
- **THEN** the Windows installer job SHALL run
- **AND** the stable bundle gate SHALL fail unless the installer job succeeds

#### Scenario: Unrelated change
- **WHEN** complete file enumeration contains no packaging-sensitive path
- **THEN** the Windows installer job SHALL be skipped
- **AND** the stable bundle gate SHALL succeed only when the classifier explicitly returns `false`

#### Scenario: Release Please version update
- **WHEN** the canonical Release Please bot opens its canonical branch with only approved generated version artifacts
- **THEN** the duplicate unsigned Windows job SHALL be skipped
- **AND** the post-merge signed release SHALL remain draft and non-Latest until its full audit succeeds

#### Scenario: Classification cannot prove a safe skip
- **WHEN** GitHub file enumeration is truncated, classifier output is missing or malformed, or a Release Please pull request contains any extra file
- **THEN** the gate SHALL fail or require the Windows installer job
- **AND** it SHALL NOT silently treat the condition as an unrelated change

### Requirement: Rust dependency resolution is reproducible

Rust CI SHALL use the committed `Cargo.lock` without modifying it, and release automation SHALL update the root `endstate-gui` package entry alongside the Cargo manifest version.

#### Scenario: Lockfile is stale
- **WHEN** a Cargo manifest change would require rewriting `Cargo.lock`
- **THEN** locked Rust CI SHALL fail

#### Scenario: Release Please bumps the GUI version
- **WHEN** Release Please creates a GUI version pull request
- **THEN** it SHALL update only the root `endstate-gui` package version in `src-tauri/Cargo.lock`

### Requirement: Main branch requires meaningful stable contexts

Main-branch protection SHALL require the stable frontend, engine-contract, Rust dependency guard, end-to-end, engine-pin, and bundle-gate contexts without requiring the optional Windows job directly.

#### Scenario: Required check fails or is missing
- **WHEN** any required stable context fails or does not report for a pull request
- **THEN** the pull request SHALL not satisfy main-branch merge requirements
