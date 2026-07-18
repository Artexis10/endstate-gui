## Why

Recent capture and import regressions reached users because pull-request checks did not consistently exercise production web builds, locked Rust state, or packaged Windows installers. The repository needs a stable, fail-closed regression gate without running the slow installer build for unrelated changes.

## What Changes

- Add production web type-check/build and locked Rust verification to normal pull-request CI.
- Add an always-reported bundle gate that classifies packaging-sensitive changes and runs the real MSI/NSIS audit only when required.
- Fail closed on incomplete GitHub file enumeration, renamed sensitive files, malformed classifier output, contaminated Release Please PRs, or failed installer audits.
- Keep the GUI package entry in `Cargo.lock` synchronized through Release Please.
- Require the stable CI contexts through main-branch protection after rollout.

## Capabilities

### New Capabilities

- `ci-regression-gates`: Layered pull-request and release-automation checks for web, Rust, engine resources, and Windows installers.

### Modified Capabilities

None.

## Impact

- GitHub Actions workflows under `.github/workflows/`
- CI policy and release workflow contract tests under `scripts/`
- `package.json`, `release-please-config.json`, and `src-tauri/Cargo.lock`
- Main-branch required status-check configuration
