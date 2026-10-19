## ADDED Requirements

### Requirement: Setup lists show failures first

The setup preview list and the setup results list (a real run or a dry run) SHALL list every row whose status is an error, and every row that needs the person to act (MANUAL), under the heading "Needs attention", above the scrolling list and outside it, with the row's reason. Other warn outcomes, such as CANCELLED, SHALL stay in the list. Such a row SHALL NOT repeat in the list below, so each filter chip SHALL still equal the rows its click shows across both places; the "N skipped" chip counts and shows every app outcome that is not installed, present or failed. A failed app row SHALL read "Couldn't install this app" and SHALL keep the engine's install message in its hover title only, because that message can name installer paths.

#### Scenario: Failures in a long run
- **WHEN** a run of 100 apps and 35 settings ends with 1 failed app and 2 failed settings
- **THEN** the three failed rows show under "Needs attention" above the list, without scrolling
- **AND** the list below holds the other 132 rows
- **AND** selecting "35 settings (2 failed)" shows 2 rows under "Needs attention" and 33 in the list

#### Scenario: Install failure and manual install
- **WHEN** one app fails with the engine message "Installer exited with code 1603" and another needs a manual install
- **THEN** both rows show under "Needs attention"
- **AND** the failed row reads "Couldn't install this app", and the engine message is in its hover title, not in the row text

#### Scenario: No failures
- **WHEN** no row failed
- **THEN** no "Needs attention" group shows

### Requirement: Setup lists keep one place for counts

The setup results header SHALL show the verdict only; the filter chips SHALL carry the counts. A run or a preview with no rows has no chips, so its header SHALL keep the app counts. The setup preview header SHALL keep only its settings line, because the settings choice sits below the list. The chip row SHALL wrap at a narrow width.

#### Scenario: Results header
- **WHEN** a run installs 2 apps, finds 1 present and restores settings with 2 failures
- **THEN** the header reads "Setup completed with errors" with no counts
- **AND** the chips read "3 apps", "2 installed", "1 present" and "8 settings (2 failed)"

#### Scenario: Dry run
- **WHEN** the same run is a dry run
- **THEN** the header reads "Preview completed with errors — nothing was installed"
- **AND** a chip reads "2 to install", and no row reads INSTALLED or RESTORED

### Requirement: Setup list rows say only what adds information

A restore row SHALL show secondary text only when it failed. A setup results row SHALL show no settings icon. An outcome that changed nothing (PRESENT, UP TO DATE, NOT IN SETUP) SHALL use the muted colour, and a filter chip SHALL take the colour of the rows it filters.

#### Scenario: Up-to-date setting
- **WHEN** a restore item ends `skipped_up_to_date`
- **THEN** its row reads "UP TO DATE" and its name, with no secondary text

#### Scenario: Present app
- **WHEN** an app is already present
- **THEN** its PRESENT label and its "N present" chip are muted, not green
