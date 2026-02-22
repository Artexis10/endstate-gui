## MODIFIED Requirements

### Requirement: Missing Fields Handling
The GUI MUST handle missing optional fields gracefully per the compatibility table.

| Field | If Missing | GUI Behavior |
|-------|------------|--------------|
| `data.appsIncluded` | Use `counts.included` for summary | Show "N apps captured" text only |
| `data.counts` | Derive from `appsIncluded.length` | Use list length as count |
| `data.captureWarnings` | Treat as empty array | No warning toast |
| `data.outputPath` | N/A (GUI reads draft from temp) | No impact |
| `error.hint` | Show message only | Omit hint from toast |
| `data.outputFormat` | Treat as `'jsonc'` (no bundle) | No config section shown |
| `data.configsIncluded` | Treat as empty array | No config count in summary |
| `data.configsSkipped` | Treat as empty array | No skipped section |
| `data.configsCaptureErrors` | Treat as empty array | No errors section |

#### Scenario: Engine without config support
- **WHEN** capture envelope has no `outputFormat`, `configsIncluded`, `configsSkipped`, or `configsCaptureErrors` fields
- **THEN** GUI behaves identically to current behavior (no config section, no config counts)

#### Scenario: Engine with config support
- **WHEN** capture envelope includes `outputFormat: 'zip'` and config arrays
- **THEN** GUI displays config module visibility in summary and details modal

## ADDED Requirements

### Requirement: Config fields in capture envelope TypeScript types
The `EndstateCaptureData` interface SHALL include optional fields for config module capture data matching engine output.

#### Scenario: Type definition includes config fields
- **WHEN** `EndstateCaptureData` is used to type capture envelope data
- **THEN** it accepts `outputFormat?: 'jsonc' | 'zip'`, `configsIncluded?: string[]`, `configsSkipped?: string[]`, `configsCaptureErrors?: string[]`
