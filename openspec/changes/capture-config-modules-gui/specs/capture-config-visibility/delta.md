## Modified Requirements

### Requirement: Config-to-app matching uses engine-provided appId

The system SHALL use the `configModules[].appId` field from the capture envelope to associate config modules with apps, instead of the substring heuristic.

#### Scenario: Config modules with appId match to apps
- **WHEN** capture envelope contains `configModules` with entries having `appId: "vscode"` and app events include `"Microsoft.VisualStudioCode"`
- **THEN** the config module is matched to that app and displayed as an inline badge

#### Scenario: Skipped modules are hidden
- **WHEN** a config module has `status: 'skipped'`
- **THEN** it is not displayed in the details modal

#### Scenario: Unmatched modules show displayName
- **WHEN** a config module's `appId` does not match any app event
- **THEN** it appears in the unmatched section using `displayName` as label

#### Scenario: Fallback to legacy heuristic
- **WHEN** `configModules` is absent or empty in the action result
- **THEN** the system falls back to matching `configsIncluded`/`configsCaptureErrors` using the legacy substring heuristic

### Requirement: CaptureConfigModule type in envelope data

The system SHALL define a `CaptureConfigModule` type with fields: `id`, `appId`, `displayName`, `status` (`'captured' | 'skipped' | 'error'`), and `filesCaptured`.

### Requirement: configModules threaded through ActionResult

The system SHALL store `configModules` on `ActionResult` when present in the capture envelope, alongside existing `configsIncluded`/`configsSkipped`/`configsCaptureErrors` fields.
