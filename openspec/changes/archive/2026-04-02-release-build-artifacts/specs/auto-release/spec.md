## ADDED Requirements

### Requirement: Build Windows installers in CI

The release workflow SHALL build Tauri Windows installers (NSIS `.exe` and MSI `.msi`) on a `windows-latest` runner when a `gui-v*` tag is pushed.

#### Scenario: Tag push triggers installer build
- **WHEN** a tag matching `gui-v*` is pushed
- **THEN** the workflow SHALL build the Go engine with version ldflags from `VERSION` and `SCHEMA_VERSION`
- **AND** the workflow SHALL run `tauri build` to produce NSIS and MSI installers

#### Scenario: Engine binary has embedded version info
- **WHEN** the Go engine is built in CI
- **THEN** the binary SHALL have `config.version` and `config.schemaVersion` set via `-ldflags` matching the values in the engine repo's `VERSION` and `SCHEMA_VERSION` files

### Requirement: Attach installer artifacts to GitHub Release

The release workflow SHALL attach the built NSIS (`.exe`) and MSI (`.msi`) installer files to the GitHub Release as downloadable assets.

#### Scenario: Installers attached to release
- **WHEN** the `tauri build` step completes successfully
- **THEN** the NSIS installer from `src-tauri/target/release/bundle/nsis/` SHALL be attached to the GitHub Release
- **AND** the MSI installer from `src-tauri/target/release/bundle/msi/` SHALL be attached to the GitHub Release

#### Scenario: Release retains existing metadata
- **WHEN** installer artifacts are attached
- **THEN** the release SHALL still contain the changelog body extracted from `CHANGELOG.md`
- **AND** `make_latest` SHALL still be set to `true`

## MODIFIED Requirements

### Requirement: Tag-triggered release workflow
The system SHALL run a GitHub Actions workflow when a tag matching `gui-v*` is pushed to the repository. The workflow SHALL build Windows installers and create a GitHub Release for that tag with the installer artifacts attached.

#### Scenario: Tag push triggers release creation
- **WHEN** a tag matching `gui-v*` (e.g., `gui-v1.0.1`) is pushed
- **THEN** the workflow builds Windows NSIS and MSI installers
- **AND** the workflow creates a GitHub Release named "GUI {version}" where {version} is the tag with the `gui-v` prefix stripped
- **AND** the installer files are attached as release assets
