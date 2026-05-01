# Spec: Engine Drift Detection

## Purpose

Automatically detect when the pinned engine version in `ENGINE_VERSION` is behind the latest published release of `Artexis10/endstate`, and open a bump PR to keep the GUI in sync with the engine.

## Requirements

### Requirement: Scheduled engine drift detection
The system SHALL provide a GitHub Actions workflow (`.github/workflows/engine-drift-check.yml`) that runs on a daily schedule and on `workflow_dispatch`, reads `ENGINE_VERSION` from the repository root, queries the latest published release from `Artexis10/endstate`, and determines whether the pin is behind using proper semver comparison.

#### Scenario: No drift detected
- **WHEN** the workflow runs
- **AND** `ENGINE_VERSION` equals the latest engine release version (after stripping the `v` prefix)
- **THEN** the workflow logs "No drift detected" and exits 0 without opening a PR or modifying any file

#### Scenario: Drift detected and assets present
- **WHEN** the workflow runs
- **AND** the latest engine release version is semver-greater than `ENGINE_VERSION`
- **AND** the latest release has both `endstate.exe` and `endstate.exe.sha256` as assets
- **THEN** the workflow updates `ENGINE_VERSION` to the new value
- **AND** opens a pull request with branch `bot/bump-engine-vX.Y.Z`, title `feat: bump engine to vX.Y.Z`

#### Scenario: Drift detected but release assets are missing
- **WHEN** the workflow runs
- **AND** the latest engine release version is semver-greater than `ENGINE_VERSION`
- **AND** the latest release is missing `endstate.exe` or `endstate.exe.sha256`
- **THEN** the workflow logs a warning that the release is incomplete
- **AND** exits 0 without modifying `ENGINE_VERSION` or opening a PR

#### Scenario: Idempotent on re-run
- **WHEN** the workflow runs
- **AND** a branch `bot/bump-engine-vX.Y.Z` already exists on the remote for the latest version
- **THEN** the workflow exits 0 without creating a duplicate branch or PR

### Requirement: Bump PR format and release-please integration
The automated bump PR SHALL use a title starting with `feat:` so that release-please includes it as a minor-version bump when merged. The PR body SHALL include a link to the engine release notes and a list of engine commits since the previous pin. When the bump is a major-version change, the PR body SHALL include a prominent warning.

#### Scenario: Minor or patch bump PR
- **WHEN** a bump PR is opened for a minor or patch version increment
- **THEN** the PR title is `feat: bump engine to vX.Y.Z`
- **AND** the PR body contains a link to the engine release on GitHub
- **AND** the PR body contains the list of engine commits since the previous ENGINE_VERSION

#### Scenario: Major version bump PR
- **WHEN** a bump PR is opened and the new major version is greater than the current major version
- **THEN** the PR body contains the text "⚠ Major version bump — review breaking changes before merging."
- **AND** the PR is still opened (not suppressed)

#### Scenario: Semver comparison correctness
- **WHEN** ENGINE_VERSION is `1.9.0` and the latest engine release is `1.10.0`
- **THEN** the workflow correctly identifies `1.10.0` as newer
- **AND** opens a bump PR (does NOT treat `1.10.0` as less than `1.9.0` due to string comparison)

### Requirement: README engine-pin badge
The repository `README.md` SHALL display a badge showing the currently pinned engine version, derived from the `ENGINE_VERSION` file, so the pinned version is visible on the repository homepage.

#### Scenario: Badge reflects current pin
- **WHEN** `ENGINE_VERSION` contains `1.8.0`
- **THEN** the README badge displays `engine | v1.8.0`
