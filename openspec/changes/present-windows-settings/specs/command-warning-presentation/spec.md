## ADDED Requirements

### Requirement: Warning details show every technical field

The GUI SHALL show a warning's `code` and, when present, its `driver`, `source`, `ref` and `moduleId` values verbatim behind the Details disclosure, on the setup results and on the capture results. It SHALL NOT show these values in the default view.

#### Scenario: Capture warning with a module
- **WHEN** a capture warning carries `code` "config_secret_scope_conflict" and `moduleId` "apps.example-editor", and the user opens Details with the show-details setting on
- **THEN** Details reads "Code: config_secret_scope_conflict · Module: apps.example-editor"

### Requirement: A secret-scope capture warning names its module in plain words

For a `config_secret_scope_conflict` capture warning, the save flow SHALL resolve `moduleId` to the display name of the matching `configModules` entry and SHALL show "Some <name> settings were not captured because they may hold private data. Its other settings were captured." When no entry matches, it SHALL show the same sentence without a name. It SHALL NOT show the engine message, which names a registry location.

#### Scenario: Module resolves to a display name
- **WHEN** a capture returns `config_secret_scope_conflict` with `moduleId` "apps.example-editor" and `configModules` has that ID with display name "Example Editor"
- **THEN** the capture warnings read "Some Example Editor settings were not captured because they may hold private data. Its other settings were captured."
- **AND** neither "registry" nor the module ID appears in the default view
