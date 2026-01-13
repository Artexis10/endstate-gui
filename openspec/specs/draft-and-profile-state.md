# OpenSpec: Draft Capture and Profile Selection State

## Purpose

Define the invariants and error semantics for:
- Capture draft handling (ephemeral vs persisted)
- Profile selection persistence (name-based only)
- Error/toast mapping for missing resources

## Invariants

### INV-1: Draft is Ephemeral

The capture "draft" exists in two forms:
1. **Transient cache file**: Written by engine to `%LOCALAPPDATA%\endstate-gui\cache\draft_*.jsonc`
2. **In-memory state**: `pendingCaptureDraft` React state holding metadata

**Rules:**
- The cache file is immediate-use only (read once after capture, then copied or deleted)
- On app reload, `pendingCaptureDraft` is null (expected behavior)
- The GUI never attempts to reload a draft from disk on startup
- Draft becomes a persisted profile ONLY when user explicitly saves

### INV-2: Profile Selection is Name-Based

**Persisted:** `selectedProfileName: string | null`

**NOT persisted:**
- No absolute paths in settings
- No `lastSelectedProfilePath` or similar legacy fields (read once for migration, never re-written)

**Runtime resolution:**
- `selectedProfilePath` is computed at runtime from `selectedProfileName` + `profilesDirectory`
- Resolution tries extensions in order: `.jsonc`, `.json`, `.json5`

### INV-3: Error Semantics are Unambiguous

| Condition | Toast Message | Guidance |
|-----------|---------------|----------|
| Draft cache file missing (during save) | "Draft capture missing — please run Capture again." | User must re-capture |
| Selected profile file missing | "Previously selected profile not found — please select a profile." | User must select different profile |
| Engine failure | "Capture failed: {error}" or "Apply failed: {error}" | Show engine error |

**Forbidden:**
- Generic "Source file no longer exists" without context
- Telling user to "run capture again" when the issue is a missing selected profile

## Capture Output Contract

### Artifact Event Shape

```typescript
interface CaptureArtifactEvent {
  type: 'artifact';
  path: string;  // Absolute path to manifest file
}
```

### Flow

1. Engine writes manifest to `--out` path (cache directory)
2. GUI receives artifact event with path
3. GUI stores metadata in `pendingCaptureDraft` (in-memory)
4. User clicks "Save profile" → file copied to profiles directory
5. User clicks "Discard" → cache file deleted, state cleared

## GUI State Model

### Persisted (localStorage)

```typescript
interface AppSettings {
  engineMode: 'bundled' | 'path' | 'script';
  engineScriptPath: string;
  customProfilesDirectory: string;
  selectedProfileName: string | null;  // NAME only, never path
  dryRunEnabled: boolean;
  showDetails: boolean;
}
```

### Ephemeral (React state)

```typescript
// Computed at runtime, never persisted
selectedProfilePath: string;  // Resolved from name + directory

// Draft capture - cleared on reload
pendingCaptureDraft: {
  capturedAppsCount: number;
  capturedAt: string;
  outputPath: string;  // Transient cache file path
  apps: string[];
} | null;
```

## Non-Goals

- **No temp draft persistence**: Draft is never reloaded from disk on app start
- **No path-based selection**: Profile selection uses name resolution, not stored paths
- **No implicit save**: Draft requires explicit user action to become a profile
