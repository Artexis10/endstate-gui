# OpenSpec: Draft Capture and Profile Selection State

## Purpose

Define the invariants and error semantics for:
- Capture draft handling (ephemeral vs persisted)
- Profile selection persistence (name-based only)
- Error/toast mapping for missing resources

## Invariants

### INV-1: Draft is Store-Based (No Disk Files)

The capture "draft" exists in two forms:
1. **localStorage**: Draft text persisted via `draft-store.ts` (survives reload/crash)
2. **In-memory state**: `pendingCaptureDraft` React state holding draft text + metadata

**Rules:**
- NO draft files are written to disk (no `draft_*.jsonc` anywhere)
- Engine writes temp file → GUI reads content → temp file deleted immediately
- Draft text stored in localStorage as JSONC string
- On app reload, draft is loaded from localStorage into `pendingCaptureDraft`
- Draft becomes a persisted profile ONLY when user explicitly saves (writes to profiles directory)

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

### INV-SAVE-1: Write Commands Must Have Non-Empty Content

**Rule:** GUI must never invoke `write_text_file` unless `content` is a non-empty string.

**Enforcement:**
- Content resolver must validate draft text is non-empty before write
- Empty string (`""`) is invalid and must be rejected
- `null` or `undefined` must be rejected

**Rationale:** Tauri command `write_text_file` requires `{ path, content }` where `content` is non-empty. Missing or empty content causes command failure.

### INV-SAVE-2: Save Profile Requires Valid Draft Content

**Rule:** If no draft content is available, Save Profile must:
1. Show toast: "No capture draft available. Please run Capture again."
2. Exit without invoking Tauri write commands

**Content Resolution Order:**
1. In-memory `pendingCaptureDraft.draftText` (non-empty)
2. Await `draft-store.loadDraft()` (non-empty)
3. Otherwise return `null`

**Validation:**
- Content must be non-empty string after trimming
- If resolution returns `null`, show error toast and exit
- Never proceed to `write_text_file` with invalid content

### INV-SAVE-MANIFEST: Profile .jsonc Must Contain Manifest Payload

**Rule:** The profile `.jsonc` file must contain the captured manifest JSONC, not metadata.

**Enforcement:**
- `write_text_file` for `<name>.jsonc` must receive `draftText` (manifest content)
- Manifest must contain profile structure: `{ name, version, apps: [...] }`
- Manifest must NEVER contain metadata fields like `displayName`
- Even if capture has 0 apps, manifest must be valid JSONC with `apps: []`

**Rationale:** The `.jsonc` file is the source of truth for the profile's application list. Metadata belongs in the separate `.meta.json` file.

### INV-SAVE-META: Metadata File Contains Display Name Only

**Rule:** The `.meta.json` file must contain metadata only, never manifest content.

**Enforcement:**
- `write_text_file` for `<name>.meta.json` must receive metadata JSON: `{ displayName: "..." }`
- Metadata must NEVER contain manifest fields like `apps`, `version`, `name`
- Metadata file is optional (only written if displayName is provided)

**Rationale:** Separation of concerns - manifest content and metadata are stored in separate files with distinct purposes.

### INV-SAVE-REFRESH: Post-Save State Updates

**Rule:** After successful profile save, the GUI must:
1. Refresh profiles list from disk (`refreshProfiles()`)
2. Select the newly saved profile (`selectedProfileName` updated)
3. Clear the draft from store and memory (`clearDraft()` + `setPendingCaptureDraft(null)`)
4. Close the save modal

**Enforcement:**
- All four steps must complete in sequence
- Draft clearing prevents stale draft from being saved again
- Profile selection ensures user sees their saved profile immediately
- Modal close provides clear feedback that save succeeded

**Rationale:** Ensures UI state is consistent with disk state and provides clear user feedback.

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
