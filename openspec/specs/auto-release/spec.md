# auto-release Specification

## Purpose
Automates GitHub Release creation with Windows installer artifacts when version tags are pushed.
## Requirements
### Requirement: Tag-triggered release workflow
The system SHALL run a GitHub Actions workflow when a tag matching `gui-v*` is pushed to the repository. The workflow SHALL build Windows installers and create a GitHub Release for that tag with the installer artifacts attached.

#### Scenario: Tag push triggers release creation
- **WHEN** a tag matching `gui-v*` (e.g., `gui-v1.0.1`) is pushed
- **THEN** the workflow builds Windows NSIS and MSI installers
- **AND** the workflow creates a GitHub Release named "GUI {version}" where {version} is the tag with the `gui-v` prefix stripped
- **AND** the installer files are attached as release assets

### Requirement: Build Windows installers in CI

The release workflow SHALL build signed Tauri Windows installers (NSIS `.exe` and MSI `.msi`) on a `windows-latest` runner when a `gui-v*` tag is pushed. Signing SHALL be performed by `tauri-apps/tauri-action@v0` during the same build step, using ed25519 keys sourced from GitHub Actions secrets.

#### Scenario: Tag push triggers installer build

- **WHEN** a tag matching `gui-v*` is pushed
- **THEN** the workflow SHALL build the Go engine with version ldflags from `VERSION` and `SCHEMA_VERSION`
- **AND** the workflow SHALL run `tauri-apps/tauri-action@v0` to produce signed NSIS and MSI installers

#### Scenario: Engine binary has embedded version info

- **WHEN** the Go engine is built in CI
- **THEN** the binary SHALL have `config.version` and `config.schemaVersion` set via `-ldflags` matching the values in the engine repo's `VERSION` and `SCHEMA_VERSION` files

#### Scenario: Signing environment sourced from secrets

- **WHEN** `tauri-apps/tauri-action@v0` runs
- **THEN** `TAURI_SIGNING_PRIVATE_KEY` SHALL be set from the GitHub Actions secret of the same name
- **AND** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` SHALL be set from the GitHub Actions secret of the same name

#### Scenario: Missing signing secrets fail the build

- **WHEN** the build job runs and either `TAURI_SIGNING_PRIVATE_KEY` or `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is unset
- **THEN** `tauri-apps/tauri-action@v0` SHALL fail the job instead of producing unsigned bundles

### Requirement: Attach installer artifacts to GitHub Release

The release workflow SHALL attach the built NSIS (`.exe`) and MSI (`.msi`) installer files and their ed25519 signature files (`.sig`) to the GitHub Release as downloadable assets.

#### Scenario: Installers and signatures attached to release

- **WHEN** the signing build step completes successfully
- **THEN** the NSIS installer (`*.exe`) from `src-tauri/target/release/bundle/nsis/` SHALL be attached to the GitHub Release
- **AND** the NSIS signature file (`*.exe.sig`) produced alongside it SHALL be attached to the GitHub Release
- **AND** the MSI installer (`*.msi`) from `src-tauri/target/release/bundle/msi/` SHALL be attached to the GitHub Release
- **AND** the MSI signature file (`*.msi.sig`) produced alongside it SHALL be attached to the GitHub Release

#### Scenario: Release retains existing metadata

- **WHEN** installer and signature artifacts are attached
- **THEN** the release SHALL still contain the changelog body extracted from `CHANGELOG.md`
- **AND** `make_latest` SHALL still be set to `true`

### Requirement: Changelog body extraction
The workflow SHALL extract the release body from CHANGELOG.md by finding the section matching the tagged version.

#### Scenario: Matching changelog section exists
- **WHEN** CHANGELOG.md contains a section headed `## [{version}]`
- **THEN** the release body SHALL contain the content between that header and the next `## [` header (or end of file)

#### Scenario: No matching changelog section
- **WHEN** CHANGELOG.md does not contain a section for the tagged version
- **THEN** the release body SHALL fall back to "See CHANGELOG.md"

### Requirement: Release metadata
The workflow SHALL set `make_latest: true` on the created release so it appears as the latest release on the repository.

#### Scenario: Release is marked latest
- **WHEN** the release is created
- **THEN** it SHALL be flagged as the latest release on the GitHub repository

### Requirement: Bundle signatures verifiable against configured pubkey

Every signed bundle attached to a GitHub Release SHALL be verifiable with the ed25519 public key committed at `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. The signing private key used in CI and the committed public key SHALL form a single keypair.

#### Scenario: Signature verifies with configured pubkey

- **WHEN** any `*.sig` file is downloaded from a GitHub Release together with its corresponding installer
- **AND** the signature is verified against the pubkey in `tauri.conf.json`
- **THEN** the verification SHALL succeed

#### Scenario: Mismatched keys prevent update install

- **WHEN** the CI signing key and the committed pubkey do not form a valid keypair (for example, during the placeholder-pubkey window before the operator rotation)
- **THEN** the in-app updater SHALL refuse to install the update and SHALL NOT surface an error to the user during auto-check

