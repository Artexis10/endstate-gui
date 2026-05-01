## MODIFIED Requirements

### Requirement: Engine binary acquisition for production builds
The build system SHALL acquire the engine binary for production Tauri bundles by downloading the pre-built `endstate.exe` from the engine repo's GitHub Release for the version declared in `ENGINE_VERSION` at the repository root. The downloaded binary SHALL be placed at `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` so Tauri's sidecar bundling resolves it without a Windows junction or a path outside the workspace.

#### Scenario: Binary downloaded and verified
- **WHEN** the CI build step reads `ENGINE_VERSION` (e.g. `1.7.7`)
- **AND** the GitHub Release `v1.7.7` exists on `Artexis10/endstate`
- **AND** the downloaded `endstate.exe` SHA-256 matches `endstate.exe.sha256`
- **THEN** the binary is placed at `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe`
- **AND** the Tauri build proceeds and bundles it in the installer

#### Scenario: Hard-fail on checksum mismatch
- **WHEN** the downloaded `endstate.exe` SHA-256 does NOT match `endstate.exe.sha256`
- **THEN** the CI step exits non-zero immediately
- **AND** the Tauri build step does NOT run

#### Scenario: Hard-fail on missing release
- **WHEN** `ENGINE_VERSION` is set to a version that has no corresponding GitHub Release (e.g. `99.99.99`)
- **THEN** the preflight `gh release view` check exits non-zero
- **AND** the download step does NOT run

### Requirement: Engine version pin file
The repository SHALL contain an `ENGINE_VERSION` file at the root containing a single semver string (e.g. `1.7.7`) that declares which pre-built engine release to bundle in the next GUI installer. This file SHALL be the sole source of truth for the bundled engine version in CI/CD.

#### Scenario: CI reads ENGINE_VERSION
- **WHEN** the release CI workflow runs
- **THEN** it reads the engine version from `ENGINE_VERSION` (not from a workflow env var or hard-coded value)
- **AND** uses that value to construct the GitHub Release download URL

#### Scenario: File tracked by release-please
- **WHEN** `release-please-config.json` is inspected
- **THEN** `ENGINE_VERSION` appears in `extra-files`
- **AND** release-please does NOT auto-bump its content during GUI version bumps

### Requirement: Local developer source-build fallback
The `scripts/rebuild-engine.cjs` build helper SHALL continue to support local developers who have the Go toolchain available by building the engine from a local engine repo checkout. When the pre-placed sidecar binary (`src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe`) already exists (e.g. placed by CI download), the script SHALL skip the Go build and copy the existing binary to the debug and release target paths instead.

#### Scenario: Pre-placed binary detected
- **WHEN** `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` exists before `rebuild-engine.cjs` runs
- **THEN** the script skips the `go build` step
- **AND** copies the binary to `src-tauri/target/debug/endstate.exe` and `src-tauri/target/release/endstate.exe`

#### Scenario: Local Go build when no pre-placed binary
- **WHEN** `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` does NOT exist
- **AND** the Go toolchain is available
- **THEN** the script builds from the local engine source
- **AND** copies the output to all required sidecar paths including `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe`
