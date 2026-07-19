## MODIFIED Requirements

### Requirement: Config-only apps are separated from installable capabilities

The GUI SHALL render config-only applications in a dedicated **Settings only — app installation not included** section, visually separated from applications represented in the installable inventory. Capture SHALL identify the main inventory as **Apps found on this PC**, explain that its entries are included for setup, and identify settings payloads as **Settings captured** so section labels do not imply package-manager ownership.

#### Scenario: Config-only apps appear in their own Capture section
- **WHEN** the engine reports captured settings for applications that have no installable capability in the profile
- **THEN** those applications are rendered under **Settings only — app installation not included**
- **AND** supporting text explains that Endstate captured their settings but the backup does not include an app installer
- **AND** they do not appear in the installable application list

#### Scenario: Installable Capture inventory explains its role
- **WHEN** the Capture result contains installable application entries
- **THEN** the main list is labeled **Apps found on this PC**
- **AND** concise supporting text explains that those entries are included for setup

#### Scenario: Config-only apps appear in their own Setup section
- **WHEN** setup preview reports settings-only entries
- **THEN** those entries remain visually separated from applications Endstate can install
- **AND** the section explains that Endstate can restore the settings but cannot install the accompanying application from this profile

#### Scenario: No config-only apps present
- **WHEN** the engine reports no config-only capabilities
- **THEN** the **Settings only — app installation not included** section is not rendered

### Requirement: Config-only items have distinct visual treatment

Config-only items SHALL be visually distinguishable from installable capabilities through the existing separated layout and settings iconography. The GUI SHALL provide a visible or accessible explanation of the settings indicator so users can distinguish an installable app with captured settings from a settings-only entry.

#### Scenario: Installable app also has captured settings
- **WHEN** an installable application row has an associated captured settings module
- **THEN** the row remains in the installable application list
- **AND** its settings indicator has the accessible meaning **Settings captured for this app**

#### Scenario: Settings-only item is distinct
- **WHEN** a config-only item is displayed
- **THEN** it uses the settings indicator within the dedicated settings-only section
- **AND** the section copy states that app installation is not included

#### Scenario: Settings legend is available
- **WHEN** captured results contain at least one settings indicator
- **THEN** the result surface provides a concise visible or accessible legend explaining that indicator
