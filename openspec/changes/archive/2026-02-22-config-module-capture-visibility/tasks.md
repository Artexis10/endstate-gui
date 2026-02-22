## Tasks

### Task 1: Extend EndstateCaptureData type
**File**: `src/types.ts`
**Action**: Add optional config fields to `EndstateCaptureData` interface:
- `outputFormat?: 'jsonc' | 'zip'`
- `configsIncluded?: string[]`
- `configsSkipped?: string[]`
- `configsCaptureErrors?: string[]`

### Task 2: Extend ActionResult type with config fields
**File**: `src/components/app/overview/types.ts`
**Action**: Add to `ActionResult`:
- `counts.configsCaptured?: number`
- `counts.configsSkipped?: number`
- `counts.configsErrored?: number`
- `configsIncluded?: string[]`
- `configsSkipped?: string[]`
- `configsCaptureErrors?: string[]`
- `outputFormat?: 'jsonc' | 'zip'`

### Task 3: Update capture-continuity helpers
**File**: `src/lib/capture-continuity.ts`
**Action**:
- Add `getCapturedConfigCount(envelopeData)` → returns `configsIncluded.length` or 0
- Update `deriveCaptureSummaryText(count, configCount?)` to append ` · N configs included` when `configCount > 0`
- Update `buildCaptureActionResult()` to accept config data and populate config counts + arrays on result

### Task 4: Update capture completion handler
**File**: `src/App.tsx`
**Action**: In `handleCaptureFromOverview` success path:
- Read `outputFormat`, `configsIncluded`, `configsSkipped`, `configsCaptureErrors` from `envelopeData`
- Pass config count to `deriveCaptureSummaryText`
- Pass config data to `buildCaptureActionResult`

### Task 5: Add CaptureConfigSummary component
**File**: `src/components/app/overview/components/capture-config-summary.tsx`
**Action**: Create component that renders config module lists grouped by status:
- "Settings captured" (green text) for `configsIncluded`
- "Settings skipped" (muted text) for `configsSkipped`
- "Settings errors" (red text) for `configsCaptureErrors`
- "No app settings captured" when all empty
- Only renders when `outputFormat === 'zip'`

### Task 6: Integrate CaptureConfigSummary into details modal
**File**: `src/components/app/overview/components/action-details-modal.tsx`
**Action**: Render `CaptureConfigSummary` below apps list when `actionResult.action === 'capture'` and `actionResult.outputFormat === 'zip'`.

### Task 7: Write unit tests
**Files**: `src/lib/capture-continuity.test.ts`, `src/components/app/overview/components/capture-config-summary.test.tsx`
**Action**:
- Test `getCapturedConfigCount` with undefined/empty/populated arrays
- Test `deriveCaptureSummaryText` with and without config count
- Test `buildCaptureActionResult` populates config counts and arrays
- Test `CaptureConfigSummary` renders correct sections for each status
- Test `CaptureConfigSummary` shows "No app settings captured" when all empty
- Test `CaptureConfigSummary` hidden when outputFormat is not 'zip'
