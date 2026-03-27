# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
- License activation via LemonSqueezy
- Advanced mode for technical details
- Engine schema compatibility handshake

### Changed

### Fixed

## [0.1.0] - 2026-03-05

### Added
- Initial release with semver versioning system

### Changed

### Fixed
