# Config-Only Visual Distinction

## Purpose

Applications that are config-only (detected settings without an installable component) are visually distinct in the GUI and remain separated from installable capabilities.

## Requirements

### Requirement: Config-only apps are separated from installable capabilities

The GUI SHALL render config-only applications in a dedicated "Settings detected for:" section, visually separated from the main capability list.

#### Scenario: Config-only apps appear in their own section
- **WHEN** the engine reports capabilities that include config-only items
- **THEN** config-only items are rendered under a "Settings detected for:" heading
- **AND** they do not appear in the main installable capabilities list

#### Scenario: No config-only apps present
- **WHEN** the engine reports no config-only capabilities
- **THEN** the "Settings detected for:" section is not rendered

### Requirement: Config-only items have distinct visual treatment

Config-only items SHALL be visually distinguishable from installable capabilities through layout, styling, or iconography so users understand these are settings, not installations.

#### Scenario: Visual distinction is apparent
- **WHEN** config-only items are displayed
- **THEN** they use a visually distinct presentation (e.g., different card style, icon, or label) that differentiates them from installable capabilities
