# Config Integration Design

**Status:** Active
**Last Updated:** 2026-02-22
**Depends on:** Engine changes `apply-restore-convergence` and `restore-filter-and-config-metadata` (both landed)

## Overview

This document defines the full configuration management integration across the Endstate GUI. It covers capture, apply, verify, revert, export, and profile view — all anchored to actual engine output shapes.

---

## Two Distinct Config Paths

### Path A: Bundle Capture (primary)

```
Capture --WithConfig → zip bundle includes config payload
    ↓
Apply --EnableRestore → restores from bundle payload
    ↓
Revert → undo via journal
```

Mental model: "My profile carries my settings."

### Path B: Export/Restore (secondary)

```
Export-config → captures current system configs to export/ dir
    ↓
Restore --EnableRestore → applies from export
    ↓
Revert → undo via journal
```

Mental model: "I want to snapshot my current settings for this profile."

Both paths use the same restore engine, both journal, both revert identically.

---

## Engine Output Shapes (Authoritative)

### restore-item NDJSON Event

Emitted during apply with `--EnableRestore` and during standalone restore. Phase: `"restore"`.

```json
{
  "version": 1,
  "runId": "apply-20260222-143052-MACHINE",
  "timestamp": "2026-02-22T14:31:00.000Z",
  "event": "restore-item",
  "id": "vscode/settings.json",
  "module": "vscode",
  "restorer": "copy",
  "source": "./configs/vscode/settings.json",
  "target": "C:/Users/user/AppData/Roaming/Code/User/settings.json",
  "status": "restored",
  "reason": null,
  "backupPath": "C:/endstate/state/backups/20260222-143052/settings.json",
  "targetExisted": true,
  "message": "Restored successfully"
}
```

**Status values:** `restoring`, `restored`, `skipped_up_to_date`, `skipped_missing_source`, `failed`

**Restorer values:** `copy`, `merge-json`, `merge-ini`, `append`

### Phase Events

Apply execution order: `plan` → `apply` → `restore` → `verify`

The `restore` phase is only emitted when `--EnableRestore` is active and restore entries exist.

### JSON Envelope Extensions (apply command)

```json
{
  "data": {
    "items": [...],
    "summary": { "total": 10, "success": 8, "skipped": 1, "failed": 1 },

    "restoreItems": [
      {
        "id": "vscode/settings.json",
        "module": "vscode",
        "restorer": "copy",
        "source": "./configs/vscode/settings.json",
        "target": "C:/Users/.../settings.json",
        "status": "restored",
        "reason": null,
        "backupPath": "C:/.../backups/20260222-143052/settings.json",
        "targetExisted": true,
        "message": "Restored successfully"
      }
    ],
    "restoreSummary": {
      "total": 6,
      "restored": 5,
      "skipped": 1,
      "failed": 0,
      "backupLocation": "C:/endstate/state/backups/20260222-143052/"
    },
    "restoreJournalFile": "C:/endstate/logs/restore-journal-20260222-143052.json",

    "restoreFilter": ["vscode", "git"],
    "restoreModulesAvailable": ["vscode", "git", "powershell", "windows-terminal"]
  }
}
```

**Notes:**
- `restoreItems`, `restoreSummary`, `restoreJournalFile` only present when restore was executed
- `restoreFilter` only present when `--RestoreFilter` was passed
- `restoreModulesAvailable` present when profile has config modules (even if filtering excluded some)

### Capture Envelope: Config Metadata

```json
{
  "data": {
    "configCapture": {
      "included": 8,
      "skipped": 2,
      "errored": 0,
      "modules": [
        { "id": "vscode", "displayName": "Visual Studio Code", "entries": 3, "files": ["settings.json", "keybindings.json", "extensions.json"] },
        { "id": "git", "displayName": "Git", "entries": 1, "files": [".gitconfig"] }
      ]
    }
  }
}
```

### --RestoreFilter Flag

```powershell
endstate apply --manifest ./profile.zip --EnableRestore --RestoreFilter vscode,git --json
```

- Absent → restore ALL modules (backward compatible)
- Present → only restore entries from listed module IDs
- Module ID matching uses `module` / `_fromModule` field on expanded restore entries

---

## Flow-by-Flow Design

### 1. CAPTURE (Phase 1 — done)

Shows config counts in result modal. Rich metadata (module list with display names) available in capture envelope.

**Remaining:** Profile card should show "12 apps · 8 settings" vs "12 apps".

### 2. SETUP/APPLY

#### 2a. Restore Intent Selection

When profile contains configs, show inline choice before running:

```
○ Install apps only (default — UX guardrail)
● Install apps and restore settings

Settings are backed up first. You can revert at any time.
```

Controls `--EnableRestore` flag. Sticky per session.

#### 2b. Per-Module Config Toggles

When restore intent is "apps and settings", show module selection:

```
Settings to restore:
☑ Visual Studio Code    3 files
☑ Git                   1 file
☐ PowerShell            1 file
☑ Windows Terminal      1 file
```

Default: all checked. Unchecked modules excluded via `--RestoreFilter`. Data source: `restoreModulesAvailable` from capabilities or profile metadata.

#### 2c. Live Activity During Execution

App items and restore items stream in the same activity feed but are visually distinct:

- App items: 📦 Microsoft.VisualStudioCode → INSTALLED (green)
- Restore items: ⚙ VSCode settings → RESTORED (blue/teal)
- Backup events inline: ↳ Backed up existing VSCode settings

Phase transitions visible: Installing apps → Restoring settings → Verifying

#### 2d. Result Modal

```
APPS                    SETTINGS
✓ 10 installed          ✓ 6 restored
✓ 2 already present     ○ 2 already up to date

Backups: Documents/Endstate/state/backups/20260222-143052/
[Details] [Revert settings] [Done]
```

Settings section only when restore was enabled. Revert button available immediately.

#### 2e. Dry-Run Preview

Shows "4 to overwrite (backed up)" vs "2 to create (new)" — communicates existing files are safe.

### 3. CHECK/VERIFY

Config modules define verify entries. Display alongside app verification. Missing configs are warnings (yellow), not errors (red).

### 4. REVERT

Available from: apply result modal, profile context menu, standalone action. Reads restore-journal-{runId}.json, processes entries in reverse, creates new backup before reverting. One level deep only.

### 5. PROFILE VIEW

```
my-machine.zip
12 apps · 8 settings
Last restore: 3 days ago (revert available)
```

Profile type detection: `.zip` = bundle with configs, `.jsonc` = manifest-only.

### 6. EXPORT/RE-CAPTURE (Path B — lower priority)

Covered by existing `config-export-restore-ux.md`.

---

## GUI Type Extensions

```typescript
// Restore intent for apply flow
type RestoreIntent = 'apps-only' | 'apps-and-settings';

// Restore item from NDJSON events and JSON envelope
interface RestoreItem {
  id: string;
  module: string;
  restorer: 'copy' | 'merge-json' | 'merge-ini' | 'append';
  source: string;
  target: string;
  status: 'restoring' | 'restored' | 'skipped_up_to_date' | 'skipped_missing_source' | 'failed';
  reason: string | null;
  backupPath: string | null;
  targetExisted: boolean;
  message: string | null;
}

// Restore summary from JSON envelope
interface RestoreSummary {
  total: number;
  restored: number;
  skipped: number;
  failed: number;
  backupLocation: string | null;
}

// Config module metadata from capture envelope
interface ConfigModuleInfo {
  id: string;
  displayName: string;
  entries: number;
  files: string[];
}

// Extended apply data
interface ApplyDataExtended {
  // existing fields...
  restoreItems?: RestoreItem[];
  restoreSummary?: RestoreSummary;
  restoreJournalFile?: string;
  restoreFilter?: string[];
  restoreModulesAvailable?: string[];
}
```

---

## Implementation Phases

| Phase | Scope | Depends On |
|-------|-------|------------|
| 2 | Restore intent + result display + streaming | Engine convergence (done) |
| 3 | Revert flow | Phase 2 |
| 4 | Verify with configs | Phase 2 |
| 5 | Profile view enhancement | Phase 2 |
| 6 | Export flow (Path B) | Phase 2 |

---

## Transparency Checklist

For every config operation, the user must answer:

1. **What configs does my profile include?** → Profile view shows config list
2. **What will happen if I restore?** → Preview shows exact files + backup plan
3. **What just happened?** → Result modal shows restored/skipped/failed + backup location
4. **Where are my backups?** → Backup path shown in result modal + profile view
5. **Can I undo this?** → "Revert" button available after every restore
6. **What will revert do?** → Revert confirmation shows exactly what changes
7. **Where are my settings stored?** → Profile path visible, bundle contents inspectable

Every answer visible without Advanced Mode. Advanced Mode reveals paths and technical details.

---

## Reversibility Guarantee

```
Backup → Modify → Journal → Revert available

No backup → No modification (safety contract)
No journal → No revert claim (honest)
```

---

## References

- `docs/config-export-restore-ux.md` — Export/restore UX specification
- `docs/ux-language.md` — Status/phase semantic rules
- `docs/ux-guardrails.md` — Forbidden behaviors
- `../endstate/docs/contracts/event-contract.md` — NDJSON event schema
- `../endstate/docs/contracts/cli-json-contract.md` — JSON envelope schema
- `../endstate/docs/contracts/config-portability-contract.md` — Restore/revert semantics
