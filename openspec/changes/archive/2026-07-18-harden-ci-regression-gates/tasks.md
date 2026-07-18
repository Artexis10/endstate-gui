## 1. Layered CI implementation

- [x] 1.1 Add the tested bundle-impact classifier and fail-closed Release Please exception.
- [x] 1.2 Add production web checks, locked Rust checks, concurrency cancellation, and the stable bundle gate.
- [x] 1.3 Synchronize the root GUI package entry in `Cargo.lock` through Release Please.

## 2. Verification

- [x] 2.1 Add policy and workflow contract tests for sensitive paths, renamed/truncated file lists, malformed output, and release automation.
- [x] 2.2 Run workflow lint, policy/resource tests, production build, lint, coverage, locked Rust tests, and strict OpenSpec validation.
- [x] 2.3 Complete an independent runtime and GitHub Actions semantics review.

## 3. Rollout

- [x] 3.1 Merge the CI-only pull request after every new stable context and the required Windows installer audit pass.
- [x] 3.2 Require the six stable GitHub Actions contexts on `main` with strict rebasing disabled.
- [x] 3.3 Archive this completed OpenSpec change in a follow-up governance pull request.
