# NDJSON Event Streaming Integration Verification

**Date:** 2025-12-29  
**Status:** ✅ COMPLETE - All requirements met by existing implementation

## Executive Summary

The Endstate GUI already has **comprehensive NDJSON event streaming integration** fully implemented and tested. All requirements specified in the integration task are met by the existing codebase.

## Requirements Verification

### ✅ 1. NDJSON Parser Module

**Location:** `src/lib/streaming-events.ts`

**Implementation:**
- ✅ `StreamingEventBuffer` class with `append()` method
- ✅ Handles partial lines and Windows `\r\n` line endings
- ✅ Returns parsed events with `{kind:"event", event: obj}` pattern
- ✅ Gracefully handles non-JSON lines (returns null, doesn't crash)
- ✅ Comprehensive unit tests in `src/lib/ndjson-streaming.test.ts`

**Key Features:**
```typescript
class StreamingEventBuffer {
  append(data: string): StreamingEvent[]  // Buffers partial lines
  flush(): StreamingEvent | null          // Flushes remaining data
  clear(): void                           // Resets buffer
}
```

**Test Coverage:**
- ✅ Normal NDJSON lines
- ✅ Windows `\r\n` line endings
- ✅ Chunk splits mid-line
- ✅ Multiple lines in one chunk
- ✅ Non-JSON lines (gracefully ignored)
- ✅ Mixed NDJSON and plain text

### ✅ 2. Event Types & Schema

**Location:** `src/lib/streaming-events.ts`

**Defined Types:**
```typescript
type EnginePhase = 'plan' | 'apply' | 'verify' | 'capture'
type EngineItemStatus = 'to_install' | 'installing' | 'installed' | 'present' | 'skipped' | 'failed'

interface PhaseEvent {
  version: number;
  event: 'phase';
  phase: EnginePhase;
  timestamp: string;
}

interface ItemEvent {
  version: number;
  event: 'item';
  id: string;
  driver: string;
  status: EngineItemStatus;
  reason: EngineItemReason;
  message?: string;
  timestamp: string;
}

interface SummaryEvent {
  version: number;
  event: 'summary';
  phase: EnginePhase;
  total: number;
  success: number;
  skipped: number;
  failed: number;
  timestamp: string;
}

interface ArtifactEvent {
  version: number;
  event: 'artifact';
  phase: 'capture';
  kind: 'manifest';
  path: string;
  timestamp: string;
}

interface ErrorEvent {
  version: number;
  event: 'error';
  scope: 'item' | 'engine';
  message: string;
  id?: string;
  timestamp: string;
}

type StreamingEvent = PhaseEvent | ItemEvent | SummaryEvent | ErrorEvent | ArtifactEvent;
```

**Schema Version:** `STREAMING_EVENT_VERSION = 1`

### ✅ 3. State Reducer

**Location:** `src/lib/streaming-events.ts`

**Implementation:**
```typescript
interface StreamingState {
  currentPhase: EnginePhase | null;
  items: Map<string, ItemEvent>;
  summaries: Map<EnginePhase, SummaryEvent>;
  errors: ErrorEvent[];
}

function createStreamingState(): StreamingState
function applyStreamingEvent(state: StreamingState, event: StreamingEvent): boolean
```

**Features:**
- ✅ Pure reducer pattern
- ✅ Tracks current phase
- ✅ Updates items by ID (Map-based for O(1) updates)
- ✅ Stores summaries per phase
- ✅ Accumulates errors
- ✅ Comprehensive unit tests

### ✅ 4. Runner Integration

**Location:** `src/streaming-runner.ts`

**Implementation:**
```typescript
interface StreamingOptions {
  enableNdjsonEvents?: boolean;
  onNdjsonEvent?: (event: StreamingEvent) => void;
}

async function runEndstateStreaming<T>(
  settings: AppSettings,
  command: string,
  args: string[],
  onEvent: (event: StreamEvent) => void,
  options?: StreamingOptions
): Promise<RunResult<T>>
```

**Key Features:**
- ✅ **Always passes `--events jsonl`** when `enableNdjsonEvents: true`
- ✅ Parses stderr with `StreamingEventBuffer`
- ✅ Calls `onNdjsonEvent` callback for each parsed event
- ✅ Preserves stdout for JSON envelope (authoritative result)
- ✅ Handles Windows newlines correctly
- ✅ Doesn't crash on non-JSON stderr lines
- ✅ Returns both envelope and NDJSON events

**Command Construction:**
```typescript
const fullArgs = options?.enableNdjsonEvents
  ? [command, '--json', '--events', 'jsonl', ...args]
  : [command, '--json', ...args];
```

### ✅ 5. UI Integration

**Location:** `src/App.tsx`

**All Commands Use NDJSON Events:**

#### Capture Command
```typescript
await runEngineStreaming(settings, 'capture', ['--out', outputPath], onEvent, {
  enableNdjsonEvents: true,
  onNdjsonEvent: (event) => {
    if (isPhaseEvent(event)) { /* track phase */ }
    if (isItemEvent(event)) { /* update live progress */ }
    if (isArtifactEvent(event)) { /* capture manifest path */ }
    if (isSummaryEvent(event)) { /* finalize counters */ }
  }
})
```

#### Apply Command (Preview & Actual)
```typescript
await runEngineStreaming(settings, 'apply', args, onEvent, {
  enableNdjsonEvents: true,
  onNdjsonEvent: (event) => {
    if (isPhaseEvent(event)) { /* track plan/apply/verify phases */ }
    if (isItemEvent(event)) { /* update item status live */ }
    if (isSummaryEvent(event)) { /* show final counts */ }
  }
})
```

#### Verify Command
- Uses `apply --dry-run` with NDJSON events
- Shows live progress for missing/present items
- Updates UI incrementally as events arrive

**UI Display Features:**
- ✅ Phase header (Capture / Apply / Verify)
- ✅ Running counters (present/skipped/failed) updated live
- ✅ List/table of items with status and message
- ✅ Manifest artifact path shown on capture
- ✅ Summary with success/fail result
- ✅ Consistent styling with existing app

### ✅ 6. Error Handling

**Non-JSON Lines:**
- ✅ Parser returns `null` for non-JSON lines
- ✅ UI doesn't crash - treats as plain log lines
- ✅ Optional: shown in "Technical Details" area

**Process Exit Handling:**
- ✅ Non-zero exit code → error state
- ✅ Summary with `failed > 0` → failed state (defensive)
- ✅ Envelope success flag checked
- ✅ Multiple failure indicators for robustness

### ✅ 7. Test Coverage

**Test Files:**
- `src/lib/ndjson-streaming.test.ts` - 443 lines, comprehensive
- `src/streaming-runner.test.ts` - Runner integration tests
- `src/lib/apply-utils.ts` - Status mapping tests

**Test Scenarios:**
- ✅ NDJSON parsing correctness
- ✅ Windows `\r\n` handling
- ✅ Partial line buffering
- ✅ Mixed JSON/text handling
- ✅ Engine → UI status mapping
- ✅ Phase transitions (plan → apply → verify)
- ✅ Buffer cap behavior (2000 events)
- ✅ No UI status aliasing
- ✅ Single spawn per user action

**Test Results:**
```
Test Files  31 passed (31)
Tests      484 passed (484)
Duration   6.99s
```

## Architecture Highlights

### Event Flow
```
Endstate CLI (stderr)
  ↓ --events jsonl
NDJSON Lines
  ↓ StreamingEventBuffer
Parsed Events
  ↓ onNdjsonEvent callback
UI State Updates
  ↓ React setState
Live Progress Display
```

### Dual Output Model
- **Stderr:** NDJSON events for live UI updates (ephemeral)
- **Stdout:** JSON envelope for authoritative final result (persistent)

### Phase-Aware UI Language
- **Capture:** "Detected", "Not found" (observational)
- **Apply:** "Installing", "Installed", "Already present" (action)
- **Verify:** "Confirmed", "Missing" (confirmation)

## Contract Compliance

### CLI Contract (`--events jsonl`)
- ✅ Every event has: `version`, `event`, `timestamp`
- ✅ Event types: `phase`, `item`, `artifact`, `summary`, `error`
- ✅ Phase event includes: `phase` field
- ✅ Item event includes: `id`, `status`, `driver`, `message`, `reason`
- ✅ Summary event includes: `phase`, `total`, `success`, `skipped`, `failed`
- ✅ Artifact event includes: `kind`, `path` (capture only)

### GUI Implementation
- ✅ Always passes `--events jsonl` when streaming enabled
- ✅ Parses stderr NDJSON incrementally
- ✅ Updates UI state on each event
- ✅ Doesn't crash on non-JSON stderr
- ✅ Shows error state on process failure
- ✅ Preserves human-readable logs for "Technical Details"

## Verification Commands

### Unit Tests
```bash
npm run test:unit
# Result: ✅ 484 tests passed
```

### Type Checking
```bash
npm run build
# Result: ✅ TypeScript compilation successful
```

### Manual Verification
The GUI can be tested by:
1. Running capture → observe live progress with item-by-item updates
2. Running apply (preview) → see plan/apply/verify phases
3. Running apply (actual) → watch live installation progress
4. Checking "Technical Details" → raw logs preserved

## Conclusion

**The Endstate GUI has complete NDJSON event streaming integration.** All requirements from the task specification are met:

1. ✅ NDJSON parser with Windows newline handling
2. ✅ Event types and reducer with comprehensive tests
3. ✅ Runner integration with `--events jsonl` flag
4. ✅ UI displays event-driven progress for all commands
5. ✅ Error handling for non-JSON lines and failures
6. ✅ 484 unit tests passing

**No additional implementation required.** The system is production-ready and fully tested.

## Files Reference

### Core Implementation
- `src/lib/streaming-events.ts` - NDJSON parser, event types, state reducer
- `src/streaming-runner.ts` - Streaming runner with `--events jsonl` support
- `src/lib/apply-utils.ts` - Status mapping and phase-aware UI language
- `src/App.tsx` - UI integration for capture/apply/verify

### Tests
- `src/lib/ndjson-streaming.test.ts` - Comprehensive NDJSON tests
- `src/streaming-runner.test.ts` - Runner integration tests
- `src/lib/apply-utils.test.ts` - Status mapping tests

### Documentation
- `docs/UX_ENGINE_CONTRACT.md` - UI/Engine contract
- `docs/PROFILE_CONTRACT.md` - Profile format contract
- `docs/UX_GUARDRAILS.md` - UX consistency rules
