# Engine Bundling

## Purpose

Bundle the Endstate engine script tree inside the Tauri/NSIS installer so the GUI ships with a working engine. Previously, the GUI resolved `endstate` from PATH or a user-configured script path, requiring separate engine installation.

## Requirements

### Requirement: Three engine resolution modes

The system SHALL support three engine resolution modes: bundled (production default), PATH, and script.

#### Scenario: Bundled mode resolves from resource directory
- **WHEN** engineMode is "bundled"
- **AND** the app is running as an installed production build
- **THEN** the engine is resolved from the Tauri resource directory at engine/bin/endstate.ps1
- **AND** it is executed via powershell.exe -NoProfile -ExecutionPolicy Bypass -File

#### Scenario: Bundled mode falls back in dev
- **WHEN** engineMode is "bundled"
- **AND** the app is running in dev mode
- **THEN** the bundled engine path is not available
- **AND** the system falls back to PATH resolution

#### Scenario: PATH mode resolves from system PATH
- **WHEN** engineMode is "path"
- **THEN** the engine is resolved as "endstate" from system PATH

#### Scenario: Script mode uses configured path
- **WHEN** engineMode is "script"
- **THEN** the engine is resolved from the user-configured script path

### Requirement: Engine tree is included in NSIS installer

The Tauri build SHALL bundle the engine script tree from the sibling `../endstate/` directory as resources, preserving the directory structure under `engine/`.

#### Scenario: Build includes engine tree
- **WHEN** `npm run tauri build` is executed
- **AND** `../endstate/` exists with the engine files
- **THEN** the installer includes engine/bin/, engine/engine/, engine/drivers/, engine/restorers/, engine/verifiers/, engine/modules/, engine/bundles/, engine/VERSION, engine/SCHEMA_VERSION

### Requirement: Engine files are not tracked in GUI repo

The bundled engine directory SHALL be excluded from git via .gitignore.

#### Scenario: Engine directory is gitignored
- **WHEN** the repository `.gitignore` is checked
- **THEN** it contains entries that exclude the bundled engine directory (e.g., `src-tauri/engine/`)
- **AND** engine binaries and data files are not committed to the GUI repo
