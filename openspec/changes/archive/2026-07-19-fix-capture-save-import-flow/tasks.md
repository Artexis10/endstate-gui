## 1. Engine Contract Repair

- [x] 1.1 Add a failing engine test requiring capture item events to emit `present` with reason `detected`.
- [x] 1.2 Restore the engine capture event vocabulary in all package capture backends and run focused Go contract tests.
- [x] 1.3 Publish the engine patch and update the GUI engine pin/checksum through the established release flow.

## 2. GUI Compatibility and Import

- [x] 2.1 Add failing TypeScript tests mapping compatibility status `captured` to detected while preserving real filtered exclusions.
- [x] 2.2 Add failing Rust tests accepting structurally valid v1/v2 manifests and rejecting unsupported versions in production and browser-bridge validators.
- [x] 2.3 Add failing import-flow tests proving success waits for discovery and selects the exact imported profile.
- [x] 2.4 Implement capture status compatibility, v1/v2 validation, transactional import outcome, error surfacing, and imported-profile selection/review.
- [x] 2.5 Consolidate Rust validation/import helpers, reject unsafe ZIP paths, and atomically validate-before-commit ZIP and bare-manifest imports.
- [x] 2.6 Gate import success on committed setup preview and surface exact validation/preview errors.

## 3. Save Completion UX

- [x] 3.1 Add failing SaveFlow tests for native saved completion, browser completion, Back to home, Open folder, and Save another copy.
- [x] 3.2 Implement the structured save outcome and explicit `Backup saved` completion state without discarding the capture result.

## 4. Cheap End-to-End Regression

- [x] 4.1 Add a tiny deterministic v2 bundle fixture and mocked bridge responses.
- [x] 4.2 Add a fast Playwright scenario covering detected capture progress, Save completion, v2 ZIP import, profile selection, and setup review without invoking winget.
- [x] 4.3 Replace semantic fixtures with engine-valid v2 provenance and add shared-core Rust validation/import tests to PR CI.

## 5. Verification and Release

- [x] 5.1 Run focused unit/Rust tests, TypeScript build, OpenSpec strict validation, and the new Playwright test.
- [x] 5.2 Run independent review and address only confirmed findings.
- [x] 5.3 Build and audit signed MSI/NSIS artifacts, smoke the packaged engine, and exercise capture-save-import against the release candidate.
- [x] 5.4 Publish the GUI hotfix only after all artifact gates pass and confirm it is GitHub Latest.
