# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
