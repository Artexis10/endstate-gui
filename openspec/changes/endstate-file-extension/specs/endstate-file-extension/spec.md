## ADDED Requirements

### Requirement: One definition of what a profile file looks like

The frontend SHALL derive every extension decision — drop acceptance, import transport selection,
file-input `accept`, dialog filters, and the schedule baseline check — from a single shared module
rather than from per-call-site string comparisons.

The Rust layer SHALL likewise hold one definition of the bundle and manifest extension lists, used
to build any OS file-picker filter it constructs.

Extension matching SHALL be case-insensitive, and SHALL ignore surrounding whitespace.

#### Scenario: Adding an extension reaches every surface at once

- **WHEN** the shared extension list changes
- **THEN** the drop zone, the native path drop handler, the import transports, the file input's
  `accept` attribute, and the dialog filters all reflect it without further edits

#### Scenario: A bundle extension inside a longer name is not a bundle

- **WHEN** a file is named `capture.endstate.jsonc` or `capture.zip.manifest.jsonc`
- **THEN** it is treated as a manifest, not a bundle

### Requirement: `.endstate` is accepted everywhere `.zip` is accepted

Every surface that accepts a `.zip` capture bundle SHALL accept a `.endstate` bundle identically,
and SHALL route it through the same import transport — the native file path to the path-based
extract command, and a DOM `File` to the base64 fallback.

`.zip` SHALL continue to be accepted permanently. This is a rename, not a format change, so a
bundle carrying either extension is the same zip container.

#### Scenario: A dropped `.endstate` path imports like a `.zip` path

- **WHEN** a `.endstate` bundle is dropped as a native file path
- **THEN** it is imported via the path-based extract command
- **AND** its bytes are never base64-encoded across IPC

#### Scenario: A dropped `.endstate` blob uses the browser fallback

- **WHEN** a `.endstate` bundle arrives as a DOM `File` with no path
- **THEN** it is base64-encoded and imported via the base64 command, exactly as a `.zip` would be

#### Scenario: The drop zone accepts both bundle extensions

- **WHEN** files named `a.endstate`, `a.ENDSTATE`, and `a.zip` are dropped
- **THEN** all of them are accepted

#### Scenario: The browse dialog can select a bundle

- **WHEN** the user opens the profile browse dialog
- **THEN** its filter offers `.endstate` and `.zip` alongside the manifest extensions

### Requirement: Saved captures default to `.endstate`

When the user saves a captured bundle, the suggested file name SHALL use `.endstate`, and the save
dialog's bundle filter SHALL offer `endstate` first with `zip` still selectable.

The capture envelope's `outputFormat` SHALL keep its existing `"zip"` value: it names the
container format, which has not changed.

#### Scenario: The save dialog suggests an `.endstate` name

- **WHEN** the user saves a capture whose output format is the bundle container
- **THEN** the suggested file name ends in `.endstate`

#### Scenario: The user may still save as `.zip`

- **WHEN** the save dialog is open for a bundle
- **THEN** `zip` remains an available extension

### Requirement: Windows associates `.endstate` with Endstate

The application bundle SHALL declare a Windows file association for the `.endstate` extension, so
that double-clicking such a file opens Endstate. Uninstalling SHALL remove the association.

The association SHALL NOT claim `.zip`, which belongs to the shell's archive handler.

#### Scenario: A `.endstate` file opens Endstate

- **WHEN** the user double-clicks a `.endstate` file on an installed Windows build
- **THEN** Endstate launches

#### Scenario: Uninstalling releases the type

- **WHEN** Endstate is uninstalled
- **THEN** the `.endstate` association it registered is removed

### Requirement: Opening a bundle imports it

A bundle opened from outside the app SHALL be imported exactly as if it had been dropped onto the
app: the same acceptance rule, the same import transport, the same navigation to the Set up flow,
and the same reporting when it fails. An association that launched the app and then ignored the
opened file would leave the user unable to tell whether anything happened.

This SHALL hold whether or not Endstate was already running. When it was, the existing window SHALL
be focused rather than a second instance started.

The decision of which launch arguments name an importable profile SHALL use the shared extension
predicate, and SHALL treat everything else as nothing to do — not as an error.

#### Scenario: Opening a bundle with the app closed imports it

- **WHEN** Endstate is launched with a `.endstate` path as an argument
- **THEN** that bundle is imported through the path-based extract command
- **AND** the Set up flow is shown, as it is for a drop

#### Scenario: Opening a bundle with the app already running imports it

- **WHEN** a bundle is opened while Endstate is running
- **THEN** the existing window is focused and raised
- **AND** the bundle is imported, without starting a second instance

#### Scenario: A bare manifest opens like a bundle

- **WHEN** Endstate is launched with a `.jsonc` manifest path as an argument
- **THEN** it is imported through the manifest import command

#### Scenario: Non-file arguments are ignored silently

- **WHEN** Endstate is launched with no arguments, or with only options such as the updater's
  `--updated`, or with an option whose value ends in a profile extension
- **THEN** no import is attempted
- **AND** no error is reported

#### Scenario: Opening a bundle mid-run is refused, not queued

- **WHEN** a bundle is opened while a run or another import is in progress
- **THEN** the import is refused with the same busy message a drop would produce

#### Scenario: Launch arguments are consumed once

- **WHEN** the webview reloads after a bundle was opened at launch
- **THEN** the bundle is not imported a second time
