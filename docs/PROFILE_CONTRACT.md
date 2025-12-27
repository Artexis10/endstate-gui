# Endstate Profile Contract

This document links to the canonical profile contract maintained in the Endstate engine repository.

## Canonical Source

**See:** [Endstate Engine - Profile Contract](https://github.com/user/endstate/blob/main/docs/profile-contract.md)

For local development, the contract is located at:
```
../endstate/docs/profile-contract.md
```

## Summary

The profile contract defines:

1. **Profile Signature** — What makes a valid profile manifest
   - `version` field (number, must be `1`)
   - `apps` field (array, may be empty)

2. **Candidate Files** — Extensions `.json`, `.jsonc`, `.json5`

3. **Excluded Files** — `*.meta.json` are GUI metadata, never profiles

4. **Validation** — Engine provides `Test-ProfileManifest` function

5. **Discovery** — GUI lists only files that pass validation

## GUI Implementation

The GUI uses the engine validator via Tauri command:

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

### Metadata

- `displayName` stored in `<profile>.meta.json`
- File names are never renamed by GUI
- Validity determined by content, not filename
