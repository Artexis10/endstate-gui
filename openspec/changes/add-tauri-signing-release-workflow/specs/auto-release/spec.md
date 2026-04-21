## MODIFIED Requirements

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
- **THEN** `TAURI_SIGNING_PRIVATE_KEY` SHALL be set from the GitHub Actions secret `TAURI_UPDATER_PRIVATE_KEY`
- **AND** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` SHALL be set from the GitHub Actions secret `TAURI_UPDATER_KEY_PASSWORD`

#### Scenario: Missing signing secrets fail the build

- **WHEN** the build job runs and either `TAURI_UPDATER_PRIVATE_KEY` or `TAURI_UPDATER_KEY_PASSWORD` is unset
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

## ADDED Requirements

### Requirement: Bundle signatures verifiable against configured pubkey

Every signed bundle attached to a GitHub Release SHALL be verifiable with the ed25519 public key committed at `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. The signing private key used in CI and the committed public key SHALL form a single keypair.

#### Scenario: Signature verifies with configured pubkey

- **WHEN** any `*.sig` file is downloaded from a GitHub Release together with its corresponding installer
- **AND** the signature is verified against the pubkey in `tauri.conf.json`
- **THEN** the verification SHALL succeed

#### Scenario: Mismatched keys prevent update install

- **WHEN** the CI signing key and the committed pubkey do not form a valid keypair (for example, during the placeholder-pubkey window before the operator rotation)
- **THEN** the in-app updater SHALL refuse to install the update and SHALL NOT surface an error to the user during auto-check
