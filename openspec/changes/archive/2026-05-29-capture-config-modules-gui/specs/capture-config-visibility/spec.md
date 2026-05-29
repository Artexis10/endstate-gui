## MODIFIED Requirements

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

#### Scenario: CaptureConfigModule parsed from envelope
- **WHEN** the capture envelope contains a `configModules` array
- **THEN** each entry is parsed into a `CaptureConfigModule` with `id`, `appId`, `displayName`, `status`, and `filesCaptured` fields

### Requirement: Config-to-app matching prefers wingetRefs for exact match

The system SHALL use `configModules[].wingetRefs` for exact case-insensitive matching against app event IDs before falling back to appId substring matching.

#### Scenario: Exact match via wingetRefs
- **WHEN** a config module has `wingetRefs: ["Microsoft.VisualStudioCode"]` and app events include `"Microsoft.VisualStudioCode"`
- **THEN** the config module is matched to that app

#### Scenario: wingetRefs case-insensitive
- **WHEN** a config module has `wingetRefs: ["Microsoft.VisualStudioCode"]` and app events include `"microsoft.visualstudiocode"`
- **THEN** the config module is matched to that app

#### Scenario: wingetRefs present but no match falls back to appId
- **WHEN** a config module has `wingetRefs: ["Some.Other.Id"]` and `appId: "vscode"` and no app event matches wingetRefs but an app event contains "vscode" as a segment
- **THEN** the config module is matched via the appId fallback

#### Scenario: wingetRefs absent or empty falls back to appId
- **WHEN** a config module has no `wingetRefs` field (or empty array) and has `appId: "vscode"`
- **THEN** the system uses appId substring matching as before

### Requirement: CaptureConfigModule includes wingetRefs

The system SHALL include an optional `wingetRefs` field (string[]) on `CaptureConfigModule`.

#### Scenario: wingetRefs parsed from envelope
- **WHEN** the capture envelope contains a configModule with `wingetRefs: ["Git.Git"]`
- **THEN** the parsed `CaptureConfigModule` includes `wingetRefs: ["Git.Git"]`

### Requirement: configModules threaded through ActionResult

The system SHALL store `configModules` on `ActionResult` when present in the capture envelope, alongside existing `configsIncluded`/`configsSkipped`/`configsCaptureErrors` fields.

#### Scenario: configModules stored on ActionResult
- **WHEN** a capture action completes and the envelope contains `configModules`
- **THEN** the `ActionResult` includes the `configModules` array accessible for display logic
