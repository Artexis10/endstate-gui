## MODIFIED Requirements

### Requirement: The release workflow SHALL build signed Tauri Windows installers (NSIS `.exe` and MSI `.msi`) on a `windows-latest` runner when a `gui-v*` tag is pushed. Signing SHALL be performed by `tauri-apps/tauri-action@v0` during the same build step, using ed25519 keys sourced from GitHub Actions secrets.

The CI build job SHALL acquire the engine binary by downloading `endstate.exe` from the GitHub Release identified by `ENGINE_VERSION`, verify its SHA-256 checksum, and place the binary at `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` before invoking the Tauri build. The build SHALL NOT require the Go toolchain or a source build of the engine binary.

#### Scenario: Engine binary downloaded before Tauri build
- **WHEN** a tag matching `gui-v*` is pushed
- **THEN** the workflow reads `ENGINE_VERSION` from the repository root
- **AND** verifies that `v{ENGINE_VERSION}` exists as a release on `Artexis10/endstate`
- **AND** downloads `endstate.exe` and `endstate.exe.sha256` from that release
- **AND** verifies the SHA-256 checksum (hard-fail on mismatch)
- **AND** places `endstate.exe` at `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe`
- **AND** the workflow runs `tauri-apps/tauri-action@v0` to produce signed NSIS and MSI installers

#### Scenario: No Go toolchain required
- **WHEN** the CI build job runs
- **THEN** no Go toolchain setup step is present
- **AND** no `go build` step is present
- **AND** the engine binary in the installer is the pre-built release asset, not a freshly compiled binary

#### Scenario: No Windows junction required
- **WHEN** the CI build job runs
- **THEN** no `mklink /J` junction creation step is present
- **AND** all paths referenced in `tauri.conf.json` resolve within the workspace checkout tree

#### Scenario: Build fails on missing engine release
- **WHEN** `ENGINE_VERSION` does not correspond to an existing GitHub Release on `Artexis10/endstate`
- **THEN** the workflow fails before the download step
- **AND** a clear error is emitted identifying the missing release version

#### Scenario: Build fails on checksum mismatch
- **WHEN** the downloaded `endstate.exe` SHA-256 hash does not match the contents of `endstate.exe.sha256`
- **THEN** the workflow step exits non-zero
- **AND** the Tauri build step does NOT run
- **AND** the run summary includes the expected and actual hash values
