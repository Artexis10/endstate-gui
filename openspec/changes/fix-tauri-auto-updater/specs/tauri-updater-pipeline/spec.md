## ADDED Requirements

### Requirement: Update endpoint resolves to current manifest
The `plugins.updater.endpoints` array in `src-tauri/tauri.conf.json` SHALL contain the GitHub Releases URL that always serves the most recently published `latest.json` for this repository. It SHALL NOT point to any manually-maintained external service.

#### Scenario: Endpoint is the GitHub releases latest URL
- **WHEN** `src-tauri/tauri.conf.json` is inspected
- **THEN** `plugins.updater.endpoints` contains `https://github.com/Artexis10/endstate-gui/releases/latest/download/latest.json`

#### Scenario: Installed app detects a newer version
- **WHEN** a new GUI release is published and `latest.json` is uploaded to that release
- **AND** an installed app whose version is lower polls the endpoint
- **THEN** the updater reports an update is available (not "up to date")

### Requirement: Release workflow hard-fails if latest.json is absent
The release workflow SHALL verify that `latest.json` is present in the GitHub Release assets after `tauri-apps/tauri-action` completes. If the file is absent, the workflow SHALL exit with a non-zero status and produce an error message, preventing a silent broken-updater release from shipping.

#### Scenario: latest.json present — workflow continues
- **WHEN** `tauri-action` completes and `latest.json` is in the release assets
- **THEN** the verification step passes and the workflow succeeds

#### Scenario: latest.json absent — workflow fails loudly
- **WHEN** `tauri-action` completes but `latest.json` is NOT in the release assets
- **THEN** the verification step exits non-zero with a descriptive error message
- **AND** the release is not considered successfully shipped

### Requirement: latest.json version field is bare semver
The `latest.json` uploaded to each GitHub Release SHALL contain a `version` field with bare semver (e.g., `2.1.0`), not a tag-prefixed value (e.g., `gui-v2.1.0`). The Tauri updater compares this value against the installed app version using semver ordering.

#### Scenario: Version field matches tauri.conf.json version
- **WHEN** `latest.json` is downloaded from a published release
- **THEN** its `version` field equals the bare semver from `tauri.conf.json` at build time (e.g., `2.1.0`)
- **AND** it does NOT contain the release tag prefix (`gui-v`)
