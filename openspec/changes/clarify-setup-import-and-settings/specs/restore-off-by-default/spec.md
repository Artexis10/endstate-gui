## MODIFIED Requirements

### Requirement: Restore is disabled unless explicitly enabled

The GUI SHALL NOT include restore operations in the default setup preview or apply workflow. The user MUST explicitly choose **Install apps and restore settings** before the GUI requests a restore-enabled dry run, and MUST explicitly select settings modules before the live Apply command includes restore flags.

#### Scenario: Default preview excludes restore
- **WHEN** a user explicitly reviews a profile
- **THEN** the CLI is invoked with `apply --dry-run` without `--enable-restore`
- **AND** the UI identifies **Install apps only** as the active intent

#### Scenario: Default apply excludes restore
- **WHEN** a user initiates Apply without choosing and selecting settings to restore
- **THEN** the CLI is invoked without restore flags
- **AND** no configuration files are overwritten on the target system

#### Scenario: Available settings remain visibly off
- **GIVEN** the install-only preview reports settings modules are available
- **WHEN** the preview completes
- **THEN** the GUI displays one concise summary that those settings will not be restored
- **AND** the GUI does not present restore-disabled compatibility rows as restore outcomes

#### Scenario: User explicitly requests a settings preview
- **WHEN** the user chooses **Install apps and restore settings**
- **THEN** the GUI visibly checks settings compatibility using a fresh `apply --dry-run --enable-restore` invocation
- **AND** Apply remains unavailable until that matching preview completes

#### Scenario: User returns to install-only intent
- **GIVEN** a restore-enabled preview has completed
- **WHEN** the user chooses **Install apps only**
- **THEN** the GUI requests a fresh `apply --dry-run` invocation without restore flags
- **AND** clears restore consent and keeps Apply unavailable until that install-only preview completes
- **AND** does not resurrect the earlier install-only result

#### Scenario: Selected settings are explicitly restored
- **GIVEN** a restore-enabled preview completed and the user selected one or more settings modules
- **WHEN** the user initiates Apply
- **THEN** the CLI invocation includes `--enable-restore` and the selected `--restore-filter`
- **AND** the GUI clearly indicates that settings restore is active before execution begins

#### Scenario: Settings preview fails
- **WHEN** the explicit restore-enabled dry run fails
- **THEN** the GUI displays that preview failure without enabling Apply from stale settings data
- **AND** the user can return to install-only intent or retry the settings preview
