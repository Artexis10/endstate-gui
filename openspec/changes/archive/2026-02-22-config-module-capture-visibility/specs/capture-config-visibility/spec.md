## ADDED Requirements

### Requirement: Capture summary includes config count
The system SHALL include config module count in the capture summary text when the capture bundle includes config modules (`outputFormat === 'zip'` and `configsIncluded.length > 0`).

#### Scenario: Capture with configs
- **WHEN** capture completes with `outputFormat: 'zip'` and `configsIncluded` has 12 entries
- **THEN** summary text reads `"67 apps captured · 12 configs included"`

#### Scenario: Capture without configs (jsonc)
- **WHEN** capture completes with `outputFormat: 'jsonc'` or no `outputFormat`
- **THEN** summary text reads `"67 apps captured"` (no config mention)

#### Scenario: Capture with zip but no configs
- **WHEN** capture completes with `outputFormat: 'zip'` and `configsIncluded` is empty
- **THEN** summary text reads `"67 apps captured"` (no config mention for zero configs)

### Requirement: Config section in Capture Details modal
The system SHALL display a config module section below the apps list in the Capture Details modal when the capture used zip bundle format.

#### Scenario: Zip capture with mixed config results
- **WHEN** user opens Capture Details for a zip capture with `configsIncluded: ['vscode-extensions', 'terminal-settings']`, `configsSkipped: ['browser-data']`, `configsCaptureErrors: ['git-config']`
- **THEN** modal shows three grouped sections: "Settings captured" with green text for included configs, "Settings skipped" with gray text for skipped configs, "Settings errors" with red text for errored configs

#### Scenario: Zip capture with no configs
- **WHEN** user opens Capture Details for a zip capture with `configsIncluded: []` and `configsSkipped: []` and `configsCaptureErrors: []`
- **THEN** modal shows "No app settings captured" in neutral (muted) text

#### Scenario: Jsonc capture (no bundle)
- **WHEN** user opens Capture Details for a jsonc capture (no `outputFormat` or `outputFormat: 'jsonc'`)
- **THEN** no config section is shown at all

### Requirement: Config counts in ActionResult
The system SHALL populate `configsCaptured`, `configsSkipped`, and `configsErrored` counts in `ActionResult.counts` when config data is present in the capture envelope.

#### Scenario: Config counts populated
- **WHEN** capture envelope contains `configsIncluded: ['a', 'b']`, `configsSkipped: ['c']`, `configsCaptureErrors: []`
- **THEN** `ActionResult.counts` includes `configsCaptured: 2`, `configsSkipped: 1`, `configsErrored: 0`

#### Scenario: No config data in envelope
- **WHEN** capture envelope has no config fields
- **THEN** `ActionResult.counts` has no config count fields (undefined)

### Requirement: Config arrays stored on ActionResult
The system SHALL store `configsIncluded`, `configsSkipped`, `configsCaptureErrors` string arrays and `outputFormat` on `ActionResult` for rendering in the details modal.

#### Scenario: Config arrays available for modal rendering
- **WHEN** capture envelope contains config arrays
- **THEN** `ActionResult` includes `configsIncluded`, `configsSkipped`, `configsCaptureErrors` arrays and `outputFormat` field
