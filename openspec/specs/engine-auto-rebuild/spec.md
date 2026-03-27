# Engine Auto-Rebuild

## Purpose

The engine binary is automatically rebuilt in the `predev` npm script so that developers always run against the latest engine code during local development. This prevents stale engine binaries from masking bugs or missing new features.

## Requirements

### Requirement: predev script rebuilds the engine

The `predev` npm script SHALL rebuild (bootstrap) the engine binary before starting the development server, ensuring the GUI runs against current engine code.

#### Scenario: Dev server uses fresh engine
- **WHEN** a developer runs `npm run dev` or `npm run tauri dev`
- **THEN** the `predev` script executes before the dev server starts
- **AND** the engine binary at the bootstrapped location is updated to reflect the latest engine source

#### Scenario: Engine changes are picked up without manual steps
- **WHEN** a developer modifies engine source code in the sibling `../endstate/` directory
- **AND** then runs `npm run dev`
- **THEN** the rebuilt engine includes those changes
- **AND** no manual `endstate bootstrap` command is required

### Requirement: Rebuild failure blocks dev server startup

The `predev` script SHALL fail the dev startup if the engine rebuild fails, preventing the GUI from running against a broken or missing engine.

#### Scenario: Broken engine source blocks dev
- **WHEN** the engine bootstrap fails (e.g., compilation error, missing source)
- **THEN** the `predev` script exits with a non-zero code
- **AND** the dev server does not start
