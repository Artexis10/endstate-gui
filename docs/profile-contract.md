# Endstate Profile Contract

This document links to the canonical profile contract maintained in the Endstate engine repository.

## Canonical Source

**See:** [Endstate Engine - Profile Contract](https://github.com/Artexis10/endstate/blob/main/docs/contracts/profile-contract.md)

For local development, the contract is located at:
```
../endstate/docs/profile-contract.md
```

## Summary

The profile contract defines:

1. **Profile Signature** — What makes a valid profile manifest
   - `version` field (supported integer `1` or `2`)
   - `apps` field (array, may be empty)
   - version `2` capture bundles include generation-aware `configCaptures[]`

2. **Candidate Files** — Extensions `.json`, `.jsonc`, `.json5`

3. **Excluded Files** — `*.meta.json` are GUI metadata, never profiles

4. **Validation** — Engine provides `Test-ProfileManifest` function

5. **Discovery** — GUI lists only files that pass validation

6. **Display Label Resolution** — Priority order for profile labels:
   - `.meta.json` displayName (highest)
   - Manifest `name` field
   - Filename stem (fallback)

7. **Rename Semantics** — GUI rename updates `.meta.json` displayName only

8. **Delete Semantics** — Cannot delete currently-selected profile

## GUI Implementation

The GUI uses one shared Tauri-free validator through the Tauri command and
development bridge:

```typescript
// Validate a profile file
const result = await invoke<ValidationResult>('validate_profile', { path });
// result: { valid: boolean, errors: string[], summary: ProfileSummary }
```

### Discovery Flow

1. List files with `.json`/`.jsonc`/`.json5` extensions
2. Exclude `*.meta.json` files
3. Validate each candidate via `validate_profile`
4. Return only valid profiles

### Display Label Resolution

When displaying a profile, resolve the label in this order:
1. `.meta.json` displayName (if present)
2. Manifest `name` field (if present)
3. Filename stem (fallback)

### Rename Behavior

- **"Rename"** updates `.meta.json` displayName only
- Filename is never changed by GUI
- Manifest `name` field is never modified by GUI

### Delete Behavior

- Deletes profile file and associated `.meta.json`
- **Cannot delete** the currently-selected profile (blocked with clear message)

### Metadata

- `displayName` stored in `<profile>.meta.json`
- `.meta.json` is an implementation detail but contractually supported
- Validity determined by content, not filename
