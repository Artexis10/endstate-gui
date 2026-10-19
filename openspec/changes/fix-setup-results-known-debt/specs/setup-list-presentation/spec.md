## ADDED Requirements

### Requirement: Setup list status text meets AA contrast

The status labels on setup preview, setup results and restore rows, and the filter chips that take their colour, SHALL have a contrast ratio of at least 4.5:1 (WCAG AA) in the light theme, on the page background, the panel, the muted surface and the chip's own 10% tint. A change to the light theme SHALL NOT lower the contrast of these labels in the dark theme.

#### Scenario: Light theme failure label
- **WHEN** a results row reads FAILED in the light theme
- **THEN** its label has a contrast ratio of at least 4.5:1 against white

#### Scenario: Light theme manual and installed labels
- **WHEN** rows read MANUAL, CANCELLED and INSTALLED in the light theme
- **THEN** each label has a contrast ratio of at least 4.5:1 against white and against its chip's tint

#### Scenario: Dark theme unchanged or better
- **WHEN** the same rows render in the dark theme
- **THEN** each label's contrast ratio is at least what it was before this change

### Requirement: Preview app chip equals its rows

The setup preview "N apps" chip SHALL count every app row that its click (clearing the filters) shows, except settings-only rows: apps to install, apps present, and manual, skipped or failed apps. With the per-app picker on, it SHALL count the selected app rows, as the other preview chips do.

#### Scenario: Skipped manual app in a preview
- **WHEN** a preview has one app to install, one app present and one manual app the engine skipped
- **THEN** the chip reads "3 apps"
- **AND** clicking it shows 3 app rows

#### Scenario: Picker deselects the manual app
- **WHEN** the per-app picker is on and the person unchecks the manual app
- **THEN** the chip reads "2 apps"

### Requirement: A failed app with no engine message keeps the phase wording

When the engine reports a failed app with no message, the row's fallback text SHALL use the same phase-aware wording as a failed app row: "Couldn't check this app (no details provided)" in a preview or dry run, and "Couldn't install this app (no details provided)" in a real run. A preview or dry run SHALL NOT say the app failed to install.

#### Scenario: No message in a preview
- **WHEN** an app fails in the plan phase with an empty message
- **THEN** its fallback text reads "Couldn't check this app (no details provided)"
- **AND** the text does not contain "install"

#### Scenario: No message in a real run
- **WHEN** an app fails in the apply phase with an empty message
- **THEN** its fallback text reads "Couldn't install this app (no details provided)"
