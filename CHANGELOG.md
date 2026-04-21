# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.7.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.7.1...gui-v1.7.2) (2026-04-21)


### Bug Fixes

* **updater:** enable createUpdaterArtifacts so .sig files are produced ([#27](https://github.com/Artexis10/endstate-gui/issues/27)) ([db79ce6](https://github.com/Artexis10/endstate-gui/commit/db79ce60284d8de0c5b9e5ab7bc708ee47bfb7fa))

## [1.7.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.7.0...gui-v1.7.1) (2026-04-21)


### Bug Fixes

* **build:** resolve pre-existing tsc errors in screenshots-harness ([#25](https://github.com/Artexis10/endstate-gui/issues/25)) ([fa01b22](https://github.com/Artexis10/endstate-gui/commit/fa01b229e4c82900378ef96efd85ae0fa5e3d2b2))
* **release:** restore npm ci step before tauri-action ([#23](https://github.com/Artexis10/endstate-gui/issues/23)) ([ad92b0e](https://github.com/Artexis10/endstate-gui/commit/ad92b0e238251296cfa038ed6d272f5a759db154))

## [1.7.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.6.0...gui-v1.7.0) (2026-04-21)


### Features

* **release:** sign installers via tauri-action for updater verification ([#21](https://github.com/Artexis10/endstate-gui/issues/21)) ([5b8826e](https://github.com/Artexis10/endstate-gui/commit/5b8826ec8d138dcc0c2b57b56aee086df6c45097))
* **updater:** integrate Tauri v2 auto-updater in GUI ([#18](https://github.com/Artexis10/endstate-gui/issues/18)) ([0d102e7](https://github.com/Artexis10/endstate-gui/commit/0d102e71f72cee122fc2d69e924ee62c2a8aa40c))

## [1.6.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.5.2...gui-v1.6.0) (2026-04-14)


### Features

* migrate license system from LemonSqueezy to Ed25519 + Paddle ([cb3d70a](https://github.com/Artexis10/endstate-gui/commit/cb3d70ae583f641abaa7a51359e5ad670744b855))


### Bug Fixes

* replace PII in setup screenshot with sanitized mock data ([62e9133](https://github.com/Artexis10/endstate-gui/commit/62e9133f2d6e7563ec3a31940982f4cb6e4b6f91))

## [Unreleased]

### Changed
- **BREAKING**: License activation now uses substratesystems.io with Ed25519-signed keys issued via Paddle checkout. The prior LemonSqueezy integration is removed.
- Offline cache is now cryptographically verified; existing caches from pre-migration builds will be discarded and users must re-activate with a newly issued license key once.
- Online re-validation runs at most every 30 days; beyond that window the app requires connectivity to re-validate.


## [1.5.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.5.1...gui-v1.5.2) (2026-04-03)


### Bug Fixes

* **ci:** add workflow_dispatch trigger for manual build recovery ([c36da22](https://github.com/Artexis10/endstate-gui/commit/c36da222d85cc915ae8bef44e5675cd6b4e9099c))
* **ci:** create empty payload directory for Tauri resource bundling ([5278a86](https://github.com/Artexis10/endstate-gui/commit/5278a86ada93fde3d112f61f8abc17e6406a4b1b))
* **ci:** create junction for engine repo at expected sidecar path ([f06b076](https://github.com/Artexis10/endstate-gui/commit/f06b076d4984cbce911badc5b9ec19bdccf60138))
* **ci:** set ENDSTATE_ENGINE_DIR for prebuild script ([128ee45](https://github.com/Artexis10/endstate-gui/commit/128ee451cc366e88362e82f9fbd7300399037d91))
* **ci:** use workspace-relative path for engine repo checkout ([f8a98cc](https://github.com/Artexis10/endstate-gui/commit/f8a98ccc86f0407dd0b7897d973aa36c1be397ac))

## [1.5.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.5.0...gui-v1.5.1) (2026-04-02)


### Bug Fixes

* **ci:** merge build into release-please workflow to fix token trigger issue ([7f46026](https://github.com/Artexis10/endstate-gui/commit/7f460268c85f0dcea46d336232a5b91cfce384bd))

## [1.5.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.4.0...gui-v1.5.0) (2026-04-02)


### Features

* **ci:** add Tauri build artifacts to release workflow ([d43de3e](https://github.com/Artexis10/endstate-gui/commit/d43de3ec9bcfc38c94934d341653901de8f0cfe0))
* embed version via ldflags and add engine staleness guard ([bddbe86](https://github.com/Artexis10/endstate-gui/commit/bddbe86621ff82dad17e35ee94a2dd96c6173446))


### Bug Fixes

* **openspec:** add missing requirement text to engine-build-ldflags delta spec ([d3b7147](https://github.com/Artexis10/endstate-gui/commit/d3b7147e21266b76f505a3406475365751abf2ff))

## [1.4.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.6...gui-v1.4.0) (2026-03-29)


### Features

* automate engine rebuild in build pipeline, unify scripts ([2eb6a6f](https://github.com/Artexis10/endstate-gui/commit/2eb6a6f997c24ad244e4847e7f46f8476a094f04))
* show bundled engine version during build and in settings ([a43e6fc](https://github.com/Artexis10/endstate-gui/commit/a43e6fc724a283c832b70789facd1cc6b641459f))


### Bug Fixes

* listen for Tauri 'enter' drag event to trigger dropzone animation ([5074e42](https://github.com/Artexis10/endstate-gui/commit/5074e4217d6a204f5611a57226e76f0991ee56ff))

## [1.3.6](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.5...gui-v1.3.6) (2026-03-29)


### Bug Fixes

* align license cache path with NSIS cleanup and wire Tauri drag events to dropzone ([3e27137](https://github.com/Artexis10/endstate-gui/commit/3e27137437f47c9cb50344505465f62fb615e0a9))

## [1.3.5](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.4...gui-v1.3.5) (2026-03-28)


### Bug Fixes

* remove unused imports in test files breaking tsc ([7852751](https://github.com/Artexis10/endstate-gui/commit/785275119fd693bf75b1a375f151ce672f2e1f96))

## [1.3.4](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.3...gui-v1.3.4) (2026-03-28)


### Bug Fixes

* **ci:** add VITE_DEV_BYPASS_LICENSE to e2e webServer env ([8fa0375](https://github.com/Artexis10/endstate-gui/commit/8fa03751f9bdcc5b22c7dd67122341f3640e0639))

## [1.3.3](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.2...gui-v1.3.3) (2026-03-28)


### Bug Fixes

* **ci:** use vite dev server directly for e2e on CI ([5703f2e](https://github.com/Artexis10/endstate-gui/commit/5703f2e0877c4daf10c1400750b05df46fcd5078))
* update e2e tests for intent-based UI, parallelize CI with 2 workers ([7eb3479](https://github.com/Artexis10/endstate-gui/commit/7eb34792723b9415ad553915b8ea60ec417a4ffa))

## [1.3.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.1...gui-v1.3.2) (2026-03-28)


### Bug Fixes

* exclude platform wrapper files from coverage thresholds ([0137576](https://github.com/Artexis10/endstate-gui/commit/01375767ab80ddb158701429df2a0d26cb1ee4b8))
* require Vite dev mode for license bypass, not just env flag ([5ca31f4](https://github.com/Artexis10/endstate-gui/commit/5ca31f41fbd312606198386518d2dd098f30068e))

## [1.3.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.3.0...gui-v1.3.1) (2026-03-28)


### Bug Fixes

* enforce bundled sidecar for all engine spawn paths ([916cbc6](https://github.com/Artexis10/endstate-gui/commit/916cbc65e3b0550fa8df86f4ba1d032310e1f3ef))

## [1.3.0](https://github.com/Artexis10/endstate-gui/compare/gui-v1.2.2...gui-v1.3.0) (2026-03-27)


### Features

* consume enriched restoreModulesAvailable and simplify display name resolution ([7aac1d8](https://github.com/Artexis10/endstate-gui/commit/7aac1d846dce642dcc3d63051f2a9cfe33cf31f7))


### Bug Fixes

* activate bundled sidecar resolution and stop silent PATH fallback ([0b23b33](https://github.com/Artexis10/endstate-gui/commit/0b23b3303dba998fc68c79cfc29741a0af533d5f))
* correct inflated app counts, filter config copy noise, and show status on settings-only apps ([64a480e](https://github.com/Artexis10/endstate-gui/commit/64a480eed52dda77875d6605973065df5de1a55c))
* show restore selection status on config-only apps in apply results ([1677f08](https://github.com/Artexis10/endstate-gui/commit/1677f08272ec2473409744b6d64c96ba3691318b))

## [1.2.2](https://github.com/Artexis10/endstate-gui/compare/gui-v1.2.1...gui-v1.2.2) (2026-03-27)


### Bug Fixes

* add gui-v tag prefix to release-please config ([b52e383](https://github.com/Artexis10/endstate-gui/commit/b52e383b7ff14875957abb57693d610fea7c683b))
* configure release-please manifest mode with gui component ([8319dcb](https://github.com/Artexis10/endstate-gui/commit/8319dcbc28fce0840d44e8c566ae452b23561123))
* sync @tauri-apps/api to match Rust tauri crate version ([97a4a80](https://github.com/Artexis10/endstate-gui/commit/97a4a8008af207a41ccc5b26bb6edc97e46293b9))

## [1.2.1](https://github.com/Artexis10/endstate-gui/compare/gui-v1.1.1...gui-v1.2.1) (2026-03-26)

### Features

* Manual app status mapping with MANUAL label (warn/yellow)
* "Install manually" section in result modal with instructions + launch link
* Config-only apps separated into "Settings detected for:" section
* Config-only apps shown in capture screen
* Auto-rebuild Go engine in predev script

### Bug Fixes

* Settings count off-by-one (17 vs 18)
* Scan cooldown to prevent winget lock contention
* Null ref handling for manual apps

### Performance

* Badge counts adjusted to exclude synthesized config-only apps

## [1.1.0] - 2026-03-10

### Added
- Per-module config restore selection: choose which app settings to restore during setup
- ConfigModuleSelector shown in setup flow when "Install apps and restore settings" is selected
- All modules default to unchecked (consistent with restore-OFF-by-default principle)
- GUI passes `--restore-filter` to engine with selected module IDs

### Changed

### Fixed

## [1.0.1] - 2026-03-06

### Fixed
- Excluded screenshots-harness.tsx from production build
- Fixed broken SVG import in intent-landing.tsx (archived icon reference)

## [1.0.0] - 2026-03-06

### Added
- Desktop GUI for Endstate provisioning engine
- Profile discovery, creation, and management
- Live activity feed with real-time streaming events
- Apply and verify workflows with result modals
- Capture workflow with app selection
- Configuration export and restore UX
- License activation via checkout provider
- Advanced mode for technical details
- Engine schema compatibility handshake

### Changed

### Fixed

## [0.1.0] - 2026-03-05

### Added
- Initial release with semver versioning system

### Changed

### Fixed
