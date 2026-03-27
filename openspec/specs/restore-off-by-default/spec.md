# Restore Off by Default

## Purpose

Configuration restore is OFF by default. Users must explicitly opt in to restore operations. This prevents accidental overwriting of existing system configuration.

## Requirements

### Requirement: Restore is disabled unless explicitly enabled

The GUI SHALL NOT include restore operations in apply workflows by default. The user must take an explicit action to enable restore.

#### Scenario: Default apply excludes restore
- **WHEN** a user initiates an apply operation without changing restore settings
- **THEN** the CLI is invoked without restore flags
- **AND** no configuration files are overwritten on the target system

#### Scenario: User explicitly enables restore
- **WHEN** a user opts in to restore via a UI control
- **THEN** the CLI is invoked with the appropriate restore flag
- **AND** the GUI clearly indicates that restore is active before execution begins

### Requirement: Restore opt-in state does not persist across sessions

The GUI SHALL reset the restore toggle to OFF each time the application starts or a new profile is loaded.

#### Scenario: Fresh session starts with restore off
- **WHEN** the application launches or a new profile is loaded
- **THEN** the restore option defaults to OFF regardless of the previous session's setting
