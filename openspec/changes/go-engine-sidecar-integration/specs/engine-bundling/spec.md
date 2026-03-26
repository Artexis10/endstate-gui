## MODIFIED Requirements

### Requirement: Three engine resolution modes

The system SHALL support three engine resolution modes: bundled (production default), PATH, and script.

#### Scenario: Bundled mode resolves Go sidecar binary
- **WHEN** engineMode is "bundled"
- **AND** the app is running as an installed production build
- **THEN** the engine is resolved as the Tauri externalBin sidecar binary (endstate.exe)
- **AND** it is executed directly as a native process with no shell wrapping
- **AND** ENDSTATE_ROOT is set to the Tauri resource directory's engine/ subdirectory

#### Scenario: Bundled mode falls back in dev
- **WHEN** engineMode is "bundled"
- **AND** the app is running in dev mode
- **THEN** the sidecar binary is not available
- **AND** the system falls back to PATH resolution

#### Scenario: PATH mode resolves from system PATH
- **WHEN** engineMode is "path"
- **THEN** the engine is resolved as "endstate" from system PATH

#### Scenario: Script mode uses configured path
- **WHEN** engineMode is "script"
- **THEN** the engine is resolved from the user-configured script path
- **AND** executed via pwsh with -NoProfile -ExecutionPolicy Bypass -File

### Requirement: Engine binary is included in installer as sidecar

The Tauri build SHALL bundle the Go engine binary from the sibling `../endstate/go-engine/` directory as an externalBin sidecar, and data directories as resources.

#### Scenario: Build includes Go sidecar and data resources
- **WHEN** `npm run tauri build` is executed
- **AND** `../endstate/go-engine/endstate-x86_64-pc-windows-msvc.exe` exists
- **THEN** the installer includes the Go engine binary as a sidecar
- **AND** the installer includes engine/modules/, engine/payload/, engine/VERSION, engine/SCHEMA_VERSION as resources

#### Scenario: Build does not include PowerShell directories
- **WHEN** `npm run tauri build` is executed
- **THEN** the installer does NOT include engine/bin/, engine/engine/, engine/drivers/, engine/restorers/, engine/verifiers/, or engine/bundles/

### Requirement: Engine files are not tracked in GUI repo

The bundled engine directory SHALL be excluded from git via .gitignore.

#### Scenario: Engine directory is gitignored
- **WHEN** the repository `.gitignore` is checked
- **THEN** it contains entries that exclude the bundled engine directory (e.g., `src-tauri/engine/`)
- **AND** engine binaries and data files are not committed to the GUI repo

### Requirement: No PowerShell wrapping in command builder

The engine command builder SHALL spawn the engine binary directly without shell wrapping.

#### Scenario: Command builder creates direct process
- **WHEN** build_engine_command() is called with an executable path
- **THEN** it creates a Command::new(exe) with args passed directly
- **AND** no CMD /C wrapping is applied
- **AND** no PowerShell -NoProfile -ExecutionPolicy Bypass flags are added
- **AND** no ENDSTATE_ALLOW_DIRECT environment variable is set

#### Scenario: Command builder sets ENDSTATE_ROOT
- **WHEN** build_engine_command() is called
- **AND** the ENDSTATE_ROOT environment variable is available
- **THEN** ENDSTATE_ROOT is passed through to the child process

### Requirement: Bundled engine resolution uses sidecar path

The engine adapter SHALL resolve the bundled engine from the Tauri sidecar binary, not from a PowerShell script in the resource directory.

#### Scenario: Engine adapter resolves sidecar for bundled mode
- **WHEN** exe is "__bundled__" in engine_run
- **THEN** the adapter resolves the Go sidecar binary path from Tauri's externalBin mechanism
- **AND** sets ENDSTATE_ROOT to the resource directory's engine/ subdirectory
- **AND** spawns the binary directly without PowerShell wrapping

## REMOVED Requirements

### Requirement: PowerShell invocation wrapping
**Reason**: The Go engine is a native binary that needs no shell wrapping. CMD /C wrapping, PowerShell -NoProfile -ExecutionPolicy Bypass flags, ENDSTATE_ALLOW_DIRECT env var, and \\?\ extended path prefix stripping are all PowerShell-specific and no longer needed.
**Migration**: Engine is spawned directly via Command::new(exe).args(args). ENDSTATE_ROOT replaces the PowerShell $PSScriptRoot-based path resolution.
