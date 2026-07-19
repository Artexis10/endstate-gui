## MODIFIED Requirements

### Requirement: Set up flow presents import and profile management

The Set up flow SHALL present a drop zone for ZIP/manifest import alongside a list of existing profiles. Profiles SHALL persist on disk. A successful import SHALL end with the exact imported profile visibly available in that list and SHALL NOT start setup preview until the user explicitly activates **Review setup**.

#### Scenario: Drop zone accepts ZIP bundles
- **WHEN** the user drops a valid ZIP bundle on the drop zone
- **THEN** the ZIP is transactionally unpacked and committed under Documents/Endstate/Profiles/
- **AND** the exact imported profile appears in the profile list with an **Imported** indicator and a **Review setup** action
- **AND** no setup preview command has run

#### Scenario: Drop zone accepts bare manifest files
- **WHEN** the user drops a valid `.jsonc`, `.json`, or `.json5` manifest file on the drop zone
- **THEN** the manifest is transactionally validated and committed under Documents/Endstate/Profiles/
- **AND** the exact imported profile appears in the profile list with an **Imported** indicator and a **Review setup** action
- **AND** no setup preview command has run

#### Scenario: Import success is independent of preview
- **WHEN** safe staging, validation, atomic commit, and exact-path discovery complete
- **THEN** the GUI reports the profile import as successful
- **AND** does not wait for or start setup preview

#### Scenario: Imported profile review is explicit
- **GIVEN** a newly imported profile is visible in the profile list
- **WHEN** the user activates **Review setup**
- **THEN** the GUI selects that exact profile and starts exactly one install-only setup preview
- **AND** the one-shot **Imported** emphasis is cleared after review begins

#### Scenario: A later import replaces recent emphasis
- **GIVEN** a profile has the one-shot **Imported** emphasis
- **WHEN** another valid profile finishes importing
- **THEN** only the most recently committed profile retains the emphasis and **Review setup** action

#### Scenario: Recent import is deleted or flow is reset
- **GIVEN** a profile has the one-shot **Imported** emphasis
- **WHEN** that profile is deleted or the Setup flow is reset
- **THEN** the recent-import state is cleared
- **AND** no later preview is started from the cleared state

#### Scenario: Preview failure does not rewrite import outcome
- **GIVEN** a profile was imported and committed successfully
- **WHEN** its explicitly requested setup preview fails
- **THEN** the GUI reports a setup preview failure rather than an import failure
- **AND** the imported profile remains available in the profile list

#### Scenario: Profile list shows all discovered profiles
- **WHEN** the Set up flow is displayed
- **THEN** the profile list shows all valid profiles from Documents/Endstate/Profiles/
- **AND** manually placed folders and bare manifests are discovered

#### Scenario: Profile management lives in Set up flow
- **WHEN** the user interacts with a profile card
- **THEN** contextual actions are available: rename, delete, inspect
- **AND** explicitly reviewing a profile leads to the apply preview flow

## ADDED Requirements

### Requirement: Profile drag state is visible and imports exactly once

The GUI SHALL visibly acknowledge supported profile files throughout browser and native Tauri drag lifecycles. It SHALL clear that state when the drag leaves, drops, is rejected, or is cancelled, and an accepted drop SHALL enter the existing transactional import path exactly once.

#### Scenario: Native supported file enters the window
- **WHEN** a Tauri v2 runtime emits enter or over for one or more supported profile paths
- **THEN** the currently visible flow displays the existing green drop-acceptance treatment and **Drop to import** message
- **AND** no import starts before drop

#### Scenario: Native drag leaves the window
- **GIVEN** native drop acceptance is visible
- **WHEN** the native drag emits leave
- **THEN** the acceptance state is cleared

#### Scenario: Native drag is cancelled or listener unmounts
- **GIVEN** native drop acceptance is visible
- **WHEN** the native drag is cancelled or its owning surface unmounts
- **THEN** the acceptance state and listener are cleared without starting an import

#### Scenario: Native supported files are dropped from the landing screen
- **WHEN** one or more supported profile paths are dropped anywhere in the idle native window
- **THEN** the GUI clears drag acceptance, routes to the Set up profile list, and imports every supported path exactly once in supplied order
- **AND** it does not start setup preview after the import completes

#### Scenario: Unsupported file is dragged
- **WHEN** every dragged file has an unsupported extension
- **THEN** the GUI does not display an accepted-drop state
- **AND** no import starts on drop

#### Scenario: Drop is blocked during active work
- **WHEN** capture, preview, apply, or another profile import is active
- **THEN** a native profile drop is rejected before staging begins
- **AND** the drag state is cleared and the GUI explains that the current operation must finish first

#### Scenario: Browser drop zone preserves interaction
- **WHEN** one or more supported browser `DataTransfer` files enter, leave, or drop on the Set up drop zone
- **THEN** the same acceptance state transitions are visible
- **AND** an accepted drop imports every supported file exactly once in supplied order
