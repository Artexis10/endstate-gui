# Phase 2: Config Restore GUI Integration

## Context

Read `docs/config-integration-design.md` for the full design. This prompt implements Phase 2: restore intent, streaming events, result display, and per-module toggles.

The engine changes have landed. The engine now emits:
- `restore-item` NDJSON events during apply with `--EnableRestore`
- `restoreItems[]` and `restoreSummary` in the JSON envelope
- `restoreFilter` and `restoreModulesAvailable` in the envelope
- Phase sequence: plan → apply → restore → verify

## Reference Files

Before making changes, read these files to understand the current architecture:

- `src/lib/streaming-events.ts` — NDJSON event types and parser
- `src/lib/apply-utils.ts` — Status mapping, StatusKey, UI_STATUS_MAP, phase-aware resolution
- `src/types.ts` — ApplyItem, ApplyCounts, envelope types
- `src/components/app/overview/types.ts` — ActionResult, LiveCounters, SetupIntent
- `src/components/app/apply-result-modal.tsx` — Current result modal
- `src/components/app/overview/use-overview-state.ts` — State management
- `src/engine-bridge.ts` — Engine event types and subscriptions
- `src/lib/engine-exec.ts` — Command building (buildEngineCommand)
- `docs/ux-language.md` — Status/phase semantic contract
- `docs/ux-guardrails.md` — Forbidden behaviors (restore OFF by default, no silent restore)

## Tasks

Work through these in order. After each task, verify the UI renders correctly in the dev server before proceeding.

### Task 1: Restore Types

Add restore-related types. These are additive — don't modify existing types.

**In `src/types.ts`**, add:

```typescript
/** Restore item from NDJSON events and JSON envelope */
export interface RestoreItem {
  id: string;
  module: string;
  restorer: 'copy' | 'merge-json' | 'merge-ini' | 'append';
  source: string;
  target: string;
  status: RestoreItemStatus;
  reason: string | null;
  backupPath: string | null;
  targetExisted: boolean;
  message: string | null;
}

export type RestoreItemStatus =
  | 'restoring'
  | 'restored'
  | 'skipped_up_to_date'
  | 'skipped_missing_source'
  | 'failed';

/** Restore summary from JSON envelope */
export interface RestoreSummary {
  total: number;
  restored: number;
  skipped: number;
  failed: number;
  backupLocation: string | null;
}

/** Config module metadata from capture envelope */
export interface ConfigModuleInfo {
  id: string;
  displayName: string;
  entries: number;
  files: string[];
}

/** Restore intent — controls --EnableRestore flag */
export type RestoreIntent = 'apps-only' | 'apps-and-settings';
```

### Task 2: Streaming Event Types for restore-item

**In `src/lib/streaming-events.ts`**:

1. Add `'restore'` to the `EnginePhase` type union
2. Add a `RestoreItemEvent` interface:

```typescript
export type RestoreItemStatus =
  | 'restoring'
  | 'restored'
  | 'skipped_up_to_date'
  | 'skipped_missing_source'
  | 'failed';

export interface RestoreItemEvent extends BaseStreamingEvent {
  event: 'restore-item';
  id: string;
  module: string;
  restorer: string;
  source: string;
  target: string;
  status: RestoreItemStatus;
  reason: string | null;
  backupPath: string | null;
  targetExisted: boolean;
  message?: string;
}
```

3. Add `RestoreItemEvent` to the `StreamingEvent` union type
4. Add a type guard: `isRestoreItemEvent(event): event is RestoreItemEvent`
5. In `StreamingState`, add `restoreItems: Map<string, RestoreItemEvent>`
6. In `createEmptyStreamingState()`, initialize `restoreItems: new Map()`
7. In `applyStreamingEvent()`, handle `isRestoreItemEvent` — store in `state.restoreItems`

### Task 3: Restore Status Mapping

**In `src/lib/apply-utils.ts`**:

Add restore-specific status config. Do NOT modify existing app status maps. Create a parallel mapping:

```typescript
/** Restore-specific status keys */
export type RestoreStatusKey =
  | 'restoring'
  | 'restored'
  | 'skipped_up_to_date'
  | 'skipped_missing_source'
  | 'failed';

/** Restore status UI mapping */
export const RESTORE_STATUS_MAP: Record<RestoreStatusKey, UiStatusConfig> = {
  restoring: {
    shortLabel: 'RESTORING',
    longLabel: 'Restoring…',
    color: 'info',
  },
  restored: {
    shortLabel: 'RESTORED',
    longLabel: 'Restored',
    color: 'success',
  },
  skipped_up_to_date: {
    shortLabel: 'UP TO DATE',
    longLabel: 'Already up to date',
    color: 'muted',
  },
  skipped_missing_source: {
    shortLabel: 'MISSING',
    longLabel: 'Source missing',
    color: 'warn',
  },
  failed: {
    shortLabel: 'FAILED',
    longLabel: 'Failed',
    color: 'error',
  },
} as const;
```

Add a helper function:

```typescript
export function getRestoreUiStatus(status: RestoreStatusKey): UiStatusConfig {
  return RESTORE_STATUS_MAP[status] ?? RESTORE_STATUS_MAP.failed;
}
```

### Task 4: RestoreIntent State in Overview

**In `src/components/app/overview/types.ts`**:

1. Import `RestoreIntent`, `RestoreItem`, `RestoreSummary` from `@/types`
2. Add to `ActionResult`:

```typescript
  restoreItems?: RestoreItem[];
  restoreSummary?: RestoreSummary;
  restoreJournalFile?: string;
  restoreModulesAvailable?: string[];
```

3. Add to `LiveCounters`:

```typescript
  configsRestored: number;
  configsSkipped: number;
  configsFailed: number;
```

**In `src/components/app/overview/use-overview-state.ts`**:

Add `restoreIntent` state alongside existing `setupIntent`:

```typescript
const [restoreIntent, setRestoreIntent] = useState<RestoreIntent>('apps-only');
```

Expose `restoreIntent` and `setRestoreIntent` from the hook return.

### Task 5: Restore Intent Toggle Component

Create `src/components/app/overview/components/restore-intent-toggle.tsx`:

A card/section that appears in the Setup flow when the selected profile has config modules. Design:

```
┌─────────────────────────────────────────────────┐
│ This profile includes settings for 8 apps       │
│                                                  │
│ ○ Install apps only                              │
│ ● Install apps and restore settings              │
│                                                  │
│ Settings are backed up first.                    │
│ You can revert at any time.                      │
└─────────────────────────────────────────────────┘
```

Props:
- `restoreIntent: RestoreIntent`
- `onRestoreIntentChange: (intent: RestoreIntent) => void`
- `configModuleCount: number` (how many config modules the profile has)
- `disabled?: boolean` (disabled during running)

Use shadcn RadioGroup. Default: 'apps-only'. Only visible when `configModuleCount > 0`.

UX rules from `docs/ux-guardrails.md`:
- Restore OFF by default (non-negotiable)
- No jargon in default mode — say "settings" not "config modules"
- Safety messaging: "backed up first", "revert at any time"

### Task 6: Per-Module Config Toggles

Create `src/components/app/overview/components/config-module-selector.tsx`:

Appears below the restore intent toggle when intent is 'apps-and-settings'. Shows checkboxes per module:

```
Settings to restore:
☑ Visual Studio Code    3 files
☑ Git                   1 file
☐ PowerShell            1 file
☑ Windows Terminal      1 file
```

Props:
- `modules: ConfigModuleInfo[]`
- `selectedModules: string[]` (module IDs)
- `onSelectionChange: (moduleIds: string[]) => void`
- `disabled?: boolean`

Default: all modules selected. Uses shadcn Checkbox. The `displayName` and `entries` count come from `ConfigModuleInfo`.

### Task 7: Wire --EnableRestore and --RestoreFilter to Engine Command

Where the apply command is built and passed to the engine (likely in the parent component that calls `onSetup`), add logic:

- When `restoreIntent === 'apps-and-settings'`, add `--enable-restore` to command args
- When specific modules are unchecked, add `--restore-filter <comma-separated-ids>` to command args
- When ALL modules are selected, omit `--restore-filter` (backward compatible: absent = all)

Find where `commandArgs` are assembled for the apply command and add these flags conditionally.

### Task 8: Restore Items in Apply Result Modal

**In `src/components/app/apply-result-modal.tsx`**:

Add an optional restore section that appears when `restoreItems` is present. The modal should show two columns or two sections:

**Apps section** (existing — unchanged):
```
✓ 10 installed
✓ 2 already present
```

**Settings section** (new — only when restore data present):
```
✓ 6 restored
○ 2 already up to date
✗ 0 failed

Backups: C:\endstate\state\backups\20260222-143052\
```

Add props:
- `restoreItems?: RestoreItem[]`
- `restoreSummary?: RestoreSummary`
- `restoreJournalFile?: string`

Categorize restore items using `getRestoreUiStatus()` for labels and colors.

Show backup location prominently (not in Advanced Mode — transparency is always-on).

Add "Revert settings" button in the footer when restore was performed (non-dry-run). For now, wire it to a placeholder callback `onRevertSettings?: () => void` — actual revert implementation is Phase 3.

### Task 9: Restore Items in Live Activity Feed

The live activity feed already shows `AppEvent` items. It needs to also show restore-item events.

The restore items should be visually distinct from app items:
- App items: use existing treatment
- Restore items: use the module display name as the label, use a distinct icon or prefix (⚙ or similar), use teal/blue color for RESTORED status

Check how the live activity currently renders `AppEvent[]` and add parallel rendering for `RestoreItemEvent[]` from `StreamingState.restoreItems`.

### Task 9: Populate ActionResult with Restore Data from Envelope

Where the apply command result is processed and stored into `ActionResult`, extract the new envelope fields:

- `data.restoreItems` → `ActionResult.restoreItems`
- `data.restoreSummary` → `ActionResult.restoreSummary`
- `data.restoreJournalFile` → `ActionResult.restoreJournalFile`
- `data.restoreModulesAvailable` → `ActionResult.restoreModulesAvailable`

Also update `LiveCounters` to track restore counts from streaming events.

## Testing Notes

- Add unit tests for `isRestoreItemEvent` type guard
- Add unit tests for `RESTORE_STATUS_MAP` mapping
- Add unit tests for `getRestoreUiStatus` helper
- Test that `applyStreamingEvent` correctly routes restore-item events to `restoreItems` map
- Test RestoreIntentToggle renders with default 'apps-only' selected
- Test restore section in ApplyResultModal only renders when restoreItems is present

## UX Rules (Non-Negotiable)

From `docs/ux-guardrails.md`:
- Restore is OFF by default. The toggle must default to "Install apps only"
- No silent restore operations
- No jargon in default mode
- Backup location always visible (transparency)
- "Revert" option always available after restore

## Verification

After all tasks, the following should work in the dev server:
1. Setup card shows restore intent toggle (when profile has configs)
2. Per-module checkboxes appear when "Install apps and restore settings" is selected
3. Apply result modal shows restore section when restore data is present
4. Live activity shows restore items with distinct visual treatment
5. All existing tests still pass (`npm run test`)
