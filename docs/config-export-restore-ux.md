# Configuration Export & Restore UX

## Overview

This document defines the UX flows for configuration export and restore in the Endstate GUI. These flows follow strict safety principles and maintain clarity about what operations do.

## Core UX Principles

### Mental Model

Make it impossible to misunderstand:
- **Apps come from manifests**
- **Configs only come from exports**
- **No export = no config restore**

This must be clear in copy, layout, and flow.

### Terminology (Consistent)

- **Export configuration** (not "bundle", "snapshot", or "sync")
- **Restore from export** (not "apply configs")
- **Revert last restore** (not "rollback" or "undo")

### No Icons

Use **color + text only**. No icons for export/restore operations.

### Explicit Actions

- No automatic config restore
- No silent operations
- Every action requires user confirmation
- Clear preview before execution

## UX Flows

### 1. Export Configuration Flow

**Entry Points:**
- Profile context menu: "Export configuration"
- Profile detail page: "Export configuration" button

**Flow:**

```
┌─────────────────────────────────────┐
│ Export Configuration Preview        │
├─────────────────────────────────────┤
│                                     │
│ Profile: my-machine                 │
│                                     │
│ What will be exported:              │
│ ✓ .gitconfig                        │
│ ✓ VSCode settings                   │
│ ✓ PowerShell profile                │
│                                     │
│ What will NOT be exported:          │
│ • No restore entries defined        │
│                                     │
│ ⚠ Sensitive path warnings:          │
│ • .ssh/config (sensitive)           │
│                                     │
│ Export location:                    │
│ manifests/export/                   │
│                                     │
│ [Cancel]  [Export Configuration]    │
└─────────────────────────────────────┘
```

**Copy Guidelines:**
- Title: "Export Configuration"
- Primary action: "Export Configuration" (green)
- Cancel: "Cancel" (gray)
- List what WILL be exported (checkmarks)
- List what will NOT be exported (if applicable)
- Show sensitive warnings prominently (yellow)
- Show export location clearly

**States:**

1. **Preview** (before export)
   - Show what will be exported
   - Show warnings
   - Show export location

2. **Exporting** (during export)
   - Progress indicator
   - "Exporting configuration..."
   - Show current file being exported

3. **Complete** (after export)
   - Success message
   - Count of exported files
   - Export location
   - Option to validate

**Error Handling:**
- Missing restore entries → Show message, disable export
- Sensitive paths → Warn but allow
- Export failure → Show error, allow retry

### 2. Validate Export Flow

**Entry Points:**
- After export complete: "Validate export" button
- Profile context menu: "Validate export"

**Flow:**

```
┌─────────────────────────────────────┐
│ Validate Export                     │
├─────────────────────────────────────┤
│                                     │
│ Profile: my-machine                 │
│                                     │
│ Checking export integrity...        │
│                                     │
│ ✓ All sources exist in export       │
│ ✓ Targets are writable              │
│ ⚠ Snapshot differs from manifest    │
│                                     │
│ Export is ready for restore.        │
│                                     │
│ [Close]  [Restore from Export]      │
└─────────────────────────────────────┘
```

**Copy Guidelines:**
- Title: "Validate Export"
- Show validation checks with status
- Green checkmarks for passed
- Yellow warnings for non-critical issues
- Red X for failures
- Clear final verdict

**States:**

1. **Validating** (during validation)
   - Progress indicator
   - "Validating export..."

2. **Valid** (passed validation)
   - Green success message
   - "Export is ready for restore"
   - Enable restore button

3. **Invalid** (failed validation)
   - Red error message
   - List of failures
   - Disable restore button
   - Show remediation steps

### 3. Restore from Export Flow

**Entry Points:**
- After validate: "Restore from Export" button
- Profile context menu: "Restore from export"

**Preview Modal:**

```
┌─────────────────────────────────────┐
│ Restore from Export                 │
├─────────────────────────────────────┤
│                                     │
│ Profile: my-machine                 │
│                                     │
│ What will be overwritten:           │
│ • .gitconfig (existing)             │
│ • VSCode settings (existing)        │
│ • PowerShell profile (new)          │
│                                     │
│ Backups will be stored at:          │
│ state/backups/abc123/               │
│                                     │
│ ⚠ This will modify system files.    │
│ Backups are created automatically.  │
│                                     │
│ [Cancel]  [Preview]  [Restore]      │
└─────────────────────────────────────┘
```

**Execution Modal:**

```
┌─────────────────────────────────────┐
│ Restoring Configuration             │
├─────────────────────────────────────┤
│                                     │
│ ✓ Backed up .gitconfig              │
│ ✓ Restored .gitconfig               │
│ → Backing up VSCode settings...     │
│                                     │
│ 2 of 3 complete                     │
│                                     │
└─────────────────────────────────────┘
```

**Result Modal:**

```
┌─────────────────────────────────────┐
│ Restore Complete                    │
├─────────────────────────────────────┤
│                                     │
│ ✓ 3 files restored                  │
│ ✓ 3 backups created                 │
│                                     │
│ Backups stored at:                  │
│ state/backups/abc123/               │
│                                     │
│ You can revert this restore using   │
│ the "Revert last restore" action.   │
│                                     │
│ [Close]  [Revert Last Restore]      │
└─────────────────────────────────────┘
```

**Copy Guidelines:**
- Title: "Restore from Export"
- Preview button: "Preview" (shows dry-run results)
- Primary action: "Restore" (green, requires confirmation)
- Show what will be overwritten (existing vs new)
- Show backup location prominently
- Warn about system modifications
- After success, offer revert option

**States:**

1. **Preview** (dry-run)
   - Show what would happen
   - No changes made
   - Enable restore button

2. **Confirm** (before restore)
   - Require explicit confirmation
   - Show backup location
   - Show warning

3. **Restoring** (during restore)
   - Progress indicator
   - Show current file
   - Show backup creation

4. **Complete** (after restore)
   - Success message
   - Show counts
   - Show backup location
   - Offer revert option

**Error Handling:**
- No export found → Show message, disable restore
- Validation failed → Show errors, disable restore
- Restore failure → Show error, show partial state
- Backup failure → Fail immediately (safety first)

### 4. Revert Last Restore Flow

**Entry Points:**
- After restore complete: "Revert Last Restore" button
- Profile context menu: "Revert last restore"
- Main menu: "Revert last restore"

**Confirmation Modal:**

```
┌─────────────────────────────────────┐
│ Revert Last Restore                 │
├─────────────────────────────────────┤
│                                     │
│ This will restore files from:       │
│ Restore run: abc123                 │
│ Timestamp: 2025-01-05 12:05:00      │
│                                     │
│ What will be reverted:              │
│ • .gitconfig                        │
│ • VSCode settings                   │
│ • PowerShell profile                │
│                                     │
│ Current state will be backed up to: │
│ state/backups/def456/               │
│                                     │
│ ⚠ This will modify system files.    │
│                                     │
│ [Cancel]  [Revert]                  │
└─────────────────────────────────────┘
```

**Execution Modal:**

```
┌─────────────────────────────────────┐
│ Reverting Restore                   │
├─────────────────────────────────────┤
│                                     │
│ ✓ Backed up current .gitconfig      │
│ ✓ Restored .gitconfig from backup   │
│ → Backing up VSCode settings...     │
│                                     │
│ 2 of 3 complete                     │
│                                     │
└─────────────────────────────────────┘
```

**Result Modal:**

```
┌─────────────────────────────────────┐
│ Revert Complete                     │
├─────────────────────────────────────┤
│                                     │
│ ✓ 3 files reverted                  │
│ ✓ Current state backed up           │
│                                     │
│ Backup location:                    │
│ state/backups/def456/               │
│                                     │
│ Files have been restored to their   │
│ state before the last restore.      │
│                                     │
│ [Close]                             │
└─────────────────────────────────────┘
```

**Copy Guidelines:**
- Title: "Revert Last Restore"
- Show which restore will be reverted
- Show timestamp for clarity
- Show what will be reverted
- Show new backup location
- Warn about system modifications
- No nested revert options (one level only)

**States:**

1. **No Restore Found**
   - Message: "No restore operation found to revert"
   - Explanation: "Revert only works if a previous restore created backups"
   - Disable revert action

2. **Confirm** (before revert)
   - Show restore details
   - Show backup location
   - Require confirmation

3. **Reverting** (during revert)
   - Progress indicator
   - Show current file
   - Show backup creation

4. **Complete** (after revert)
   - Success message
   - Show counts
   - Show backup location

## Color Coding

Use consistent color coding across all flows:

- **Green**: Success, valid, safe actions
- **Yellow**: Warnings, sensitive paths, non-critical issues
- **Red**: Errors, failures, critical issues
- **Gray**: Disabled, canceled, neutral
- **Blue**: Informational, in-progress

## Text-Only Status Indicators

No icons. Use text prefixes:

- `✓` Success / Complete
- `⚠` Warning
- `✗` Error / Failed
- `→` In Progress
- `•` List item / Neutral

## Layout Patterns

### Preview Sections

```
What will be [action]:
✓ Item 1
✓ Item 2
✓ Item 3

What will NOT be [action]:
• Reason 1
• Reason 2

⚠ Warnings:
• Warning 1
• Warning 2
```

### Progress Sections

```
✓ Completed step 1
✓ Completed step 2
→ Current step 3
  Pending step 4

X of Y complete
```

### Result Sections

```
✓ X items [action]
✓ Y backups created

[Location]:
path/to/location

[Next steps or explanation]
```

## Integration Points

### Profile Card

Add actions to profile context menu:
- Export configuration
- Validate export
- Restore from export
- Revert last restore (if applicable)

### Main Menu

Add top-level actions:
- Export configuration (requires selected profile)
- Revert last restore (global, no profile required)

### Activity Log

Show export/restore/revert operations in activity log:
- "Exported configuration for my-machine"
- "Restored configuration from export"
- "Reverted last restore"

## Error Messages

### Export Errors

**No restore entries:**
```
Cannot export configuration

No restore entries defined in manifest.
Add restore entries to enable configuration export.

[Close]
```

**Export failed:**
```
Export failed

Failed to export 2 of 5 files:
• .gitconfig: Permission denied
• VSCode settings: File not found

[Close]  [Retry]
```

### Validate Errors

**Export not found:**
```
Export not found

No export folder found at:
manifests/export/

Export configuration first before validating.

[Close]  [Export Configuration]
```

**Validation failed:**
```
Export validation failed

2 sources missing from export:
• .gitconfig
• PowerShell profile

Re-export configuration to fix.

[Close]  [Re-export]
```

### Restore Errors

**No export:**
```
Cannot restore

No export found for this profile.
Export configuration first.

[Close]  [Export Configuration]
```

**Restore failed:**
```
Restore failed

Failed to restore 1 of 3 files:
• VSCode settings: Permission denied

Partial restore completed.
2 files were restored successfully.

[Close]  [Revert]
```

### Revert Errors

**No restore found:**
```
No restore to revert

No restore operation found with backups.
Revert only works after a restore operation.

[Close]
```

**Revert failed:**
```
Revert failed

Failed to revert 1 of 3 files:
• .gitconfig: Permission denied

Partial revert completed.
2 files were reverted successfully.

[Close]
```

## Accessibility

- All actions keyboard accessible
- Clear focus indicators
- Screen reader friendly labels
- High contrast color coding
- No reliance on color alone (text + color)

## Testing Checklist

- [ ] Export preview shows correct files
- [ ] Sensitive path warnings display
- [ ] Validate shows correct status
- [ ] Restore preview shows overwrites
- [ ] Backup location is clear
- [ ] Revert shows correct restore
- [ ] Error messages are actionable
- [ ] Progress indicators work
- [ ] Success states are clear
- [ ] No automatic operations
- [ ] All actions require confirmation
- [ ] Color coding is consistent
- [ ] Text-only indicators work
- [ ] Keyboard navigation works

## Implementation Notes

### CLI Bridge

Use existing CLI commands:
- `export-config` for export
- `validate-export` for validation
- `restore` with `-EnableRestore` for restore
- `revert` for revert

### State Management

Track:
- Current export status (exists, valid, invalid)
- Last restore run ID
- Backup locations
- Operation history

### Event Streaming

Use JSONL events for progress:
- Export progress
- Validation progress
- Restore progress
- Revert progress

### Data Types

Add to `types.ts`:
```typescript
export interface ExportData {
  exportPath: string;
  exportCount: number;
  skipCount: number;
  warnCount: number;
  warnings: string[];
}

export interface ValidateExportData {
  valid: boolean;
  validCount: number;
  warnCount: number;
  failCount: number;
  warnings: string[];
  errors: string[];
}

export interface RevertData {
  revertedRestoreRunId: string;
  revertCount: number;
  skipCount: number;
  failCount: number;
  backupLocation: string;
}
```

## Future Enhancements (Not MVP)

- Export versioning (git integration)
- Export diff visualization
- Selective restore (choose which files)
- Export templates
- Remote export sharing (with encryption)

These are **not** part of the initial implementation.
