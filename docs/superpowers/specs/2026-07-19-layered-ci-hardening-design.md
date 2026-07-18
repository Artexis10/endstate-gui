# Layered CI hardening

## Goal

Make pull-request CI fail closed on meaningful regressions while avoiding duplicate Windows installer builds.

## Design

Every pull request keeps the fast Linux checks: frontend type-check/production build and unit/coverage, CI policy contracts, the pinned-engine contract, locked shared Rust-core tests plus the dev-bridge dependency guard, and semantic Playwright journeys. Stale runs for superseded commits are cancelled.

The installer workflow runs for every pull request so it always reports one stable `bundle-gate` status. A small Linux classifier decides whether the real Windows bundle job is required:

- manual dispatch always builds;
- Release Please version-only branches skip the duplicate unsigned build because the post-merge release workflow builds, signs, audits, and smokes the installers while the release is still a draft;
- changes under `src-tauri/**`, the engine pin, package manifests, bundle/resource scripts, release configuration, or bundle/release workflows require the Windows build;
- unrelated changes skip it.

`bundle-gate` runs after classification and the optional Windows job. It succeeds only when classification succeeded and, when required, the Windows build succeeded. This gives branch protection a status that exists on every pull request without paying the latency of Windows packaging on unrelated changes.

Branch protection requires the frontend tests, engine contract, Rust/bridge guard, Playwright, engine pin, and `bundle-gate`. The branch does not require strict rebasing, which would create extra reruns for no material safety gain here.

Release Please updates the GUI package entry in `Cargo.lock` alongside `Cargo.toml`. Rust CI uses `--locked`, making unexpected dependency or root-version drift a failure instead of silently rewriting the lockfile.

## Testing

A pure Node policy module owns path and Release Please classification. Table-driven tests cover manual dispatch, release branches, ordinary UI/docs changes, and every bundle-sensitive path family. Workflow contract tests assert that CI invokes the Rust suite and that the always-reported gate consumes the classifier and optional bundle result.

## Non-goals

- No dependency upgrades.
- No product or release-version change.
- No consolidation of parallel Linux jobs; their parallelism keeps feedback fast and standard public-repository runners are not billed.
- No weakening of the final signed release audit.
