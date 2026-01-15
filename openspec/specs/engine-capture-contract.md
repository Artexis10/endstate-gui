# Engine Capture Contract (GUI-Side)

## Normative Statement

This document defines the **GUI's expectations** of the engine capture envelope.

- **Normative side**: GUI (this document)
- **Authoritative source**: Engine's `openspec/specs/capture-artifact-contract.md`
- **Relationship**: GUI consumes what engine produces; engine contract is authoritative for output shape

If engine output changes, this document MUST be updated to match.

## Compatibility {#compatibility}

### Schema Version

- GUI MUST accept `schemaVersion: "1.0"`
- GUI SHOULD warn on unknown schemaVersion but attempt parsing
- GUI MUST NOT fail on missing optional fields

### Missing Fields Handling

| Field | If Missing | GUI Behavior |
|-------|------------|--------------|
| `data.appsIncluded` | Use `counts.included` for summary | Show "N apps captured" text only |
| `data.counts` | Derive from `appsIncluded.length` | Use list length as count |
| `data.captureWarnings` | Treat as empty array | No warning toast |
| `data.outputPath` | N/A (GUI reads draft from temp) | No impact |
| `error.hint` | Show message only | Omit hint from toast |

## Engine Envelope Shape {#envelope-shape}

### Success Response

```json
{
  "schemaVersion": "1.0",
  "cliVersion": "x.y.z",
  "command": "capture",
  "timestampUtc": "2024-01-15T10:00:00Z",
  "success": true,
  "data": {
    "outputPath": "C:\\path\\to\\manifest.jsonc",
    "sanitized": false,
    "isExample": false,
    "counts": {
      "totalFound": 50,
      "included": 45,
      "skipped": 5,
      "filteredRuntimes": 3,
      "filteredStoreApps": 2,
      "sensitiveExcludedCount": 0
    },
    "appsIncluded": [
      { "id": "Git.Git", "source": "winget" },
      { "id": "Docker.DockerDesktop", "source": "winget" }
    ],
    "captureWarnings": ["WINGET_EXPORT_FAILED_FALLBACK_USED"]
  },
  "error": null
}
```

### Failure Response

```json
{
  "schemaVersion": "1.0",
  "cliVersion": "x.y.z",
  "command": "capture",
  "timestampUtc": "2024-01-15T10:00:00Z",
  "success": false,
  "data": null,
  "error": {
    "code": "WINGET_CAPTURE_EMPTY",
    "message": "No applications were captured.",
    "hint": "Ensure winget is properly configured."
  }
}
```

## Canonical Sources {#canonical-source}

### App List Source

The GUI MUST use `data.appsIncluded` as the **primary canonical source** for the captured app list.

- **Primary**: `envelopeData.appsIncluded` from engine JSON envelope
- **NDJSON fallback**: If `appsIncluded` is empty/missing but NDJSON streaming events exist, use those for modal display
- **Never**: Do not parse manifest content to derive app list

**CRITICAL**: Count and app list MUST derive from the same source. If using NDJSON fallback for the list, count MUST also derive from that list length (not from `counts.included`).

### Count Source

- **Primary**: `appsIncluded.length` (derived from canonical list)
- **Fallback**: `counts.included` (only if list unavailable)
- **Backward compatibility**: `counts.captured` may exist historically, but GUI prefers `counts.included`

**CRITICAL**: GUI MUST derive count FROM `appsIncluded.length` first, not from `counts.included`. This ensures consistency between the displayed count and the app list shown in modals.

## Invariants {#invariants}

### INV-CONTINUITY-1: Counts Must Match Apps List Length {#inv-continuity-1}

- `counts.included` MUST equal `appsIncluded.length` (engine guarantees this)
- GUI MUST NOT filter or transform `appsIncluded` in ways that change count
- If mismatch detected: log warning, display `appsIncluded.length` as truth
- **Enforced by**: `src/lib/capture-continuity.test.ts`

### INV-DETAILS-1: Capture Details Must Render App List {#inv-details-1}

- Capture Details modal MUST show scrollable list of captured apps
- Source: `appsIncluded` converted to `AppEvent[]` via `capturedAppsToAppEvents()`
- Count displayed MUST equal list length shown
- **Implementation**: `src/lib/capture-continuity.ts`

### INV-SANITIZE-1: GUI Relies on Engine Sanitization {#inv-sanitize-1}

- Engine guarantees all IDs in `appsIncluded` are sanitized (per engine INV-SANITIZE-IDS-1)
- GUI MUST NOT re-sanitize app IDs
- GUI MAY validate IDs defensively but MUST NOT modify them
- **Enforced by**: `src/lib/capture-continuity.test.ts` (detection tests)

### INV-FALLBACK-1: Fallback Warning Toast Only {#inv-fallback-1}

- If `captureWarnings` includes `WINGET_EXPORT_FAILED_FALLBACK_USED`:
  - Show non-blocking info toast
  - Do NOT block capture success
  - Do NOT show error state

## Non-Goals {#non-goals}

The GUI explicitly does NOT:

- Parse manifest file content to derive app list
- Re-sanitize app IDs received from engine
- Validate manifest structure (engine responsibility)
- Handle `winget` CLI errors directly (engine abstracts these)
- Persist raw engine envelope (only derived state)

## Failure Modes Table {#failure-modes}

| Condition | UI Behavior |
|-----------|-------------|
| `appsIncluded` present, length > 0 | Show scrollable app list in Details modal |
| `appsIncluded` empty, NDJSON events exist | Use NDJSON events for modal list; count = events.length |
| `appsIncluded` empty, no NDJSON events | Show "No applications detected" |
| `success: false`, `error.code` present | Show error toast with `error.message` |
| `success: false`, `error.code` = `WINGET_CAPTURE_EMPTY` | Show specific empty capture error |
| `success: false`, `error.code` = `ENGINE_CLI_NOT_FOUND` | Show error, suggest bootstrap |

## Error Codes

| Code | Description | UI Action |
|------|-------------|-----------|
| `ENGINE_CLI_NOT_FOUND` | CLI binary not found | Show error, suggest bootstrap |
| `MANIFEST_WRITE_FAILED` | Could not write manifest | Show error toast |
| `CAPTURE_FAILED` | Generic capture failure | Show error toast |
| `WINGET_CAPTURE_EMPTY` | No apps captured | Show specific empty error |

## Warning Codes

| Code | Description | UI Action |
|------|-------------|-----------|
| `WINGET_EXPORT_FAILED_FALLBACK_USED` | winget export failed, used fallback | Info toast only |

## TypeScript Types

See `src/types.ts`:
- `EndstateEnvelope<T>` - Generic envelope wrapper
- `EndstateCaptureData` - Capture-specific data shape
- `CapturedApp` - App entry in `appsIncluded`
- `CaptureCounts` - Counts object shape
- `EndstateError` - Error object shape

## Test Coverage {#test-coverage}

### Vitest Tests (GUI)

- **INV-CONTINUITY-1**: `counts.included` equals `appsIncluded.length`
- **INV-CONTINUITY-1**: Mismatch detection (72 vs 66 regression)
- **INV-DETAILS-1**: `capturedAppsToAppEvents()` produces correct `AppEvent[]`
- **INV-DETAILS-1**: `buildCaptureActionResult()` produces valid ActionResult with appEvents
- **INV-DETAILS-1**: REGRESSION - appsIncluded present but modal receives empty appEvents
- **INV-DETAILS-1**: Header count equals rendered list length
- **INV-SANITIZE-1**: Dirty ID detection (non-ASCII prefix, backslashes)
- **INV-FALLBACK-1**: Warning toast behavior (not tested in unit tests)
- **deriveCaptureSummaryText**: REGRESSION - must NOT return "No apps detected" when count > 0
- **Overview flow**: REGRESSION - count derived from appsIncluded.length must match appEvents.length
- **Overview flow**: REGRESSION - normal case produces consistent count and appEvents
- **Modal fallback**: INVARIANT - if appEvents.length > 0, modal must NOT show fallback text
- **NDJSON fallback**: REGRESSION - appsIncluded empty + NDJSON events = use NDJSON for modal
- **NDJSON fallback**: REGRESSION - appsIncluded present = use appsIncluded (no fallback needed)
- **Wiring invariant**: detailsAction="capture" -> actionResultByAction["capture"] has consistent count/appEvents

See: `src/lib/capture-continuity.test.ts`

## Implementation References

- `src/lib/capture-continuity.ts` - Continuity validation helpers
- `src/App.tsx` - `handleCaptureFromOverview()` processes envelope
- `src/components/app/overview/components/action-details-modal.tsx` - Renders app list
