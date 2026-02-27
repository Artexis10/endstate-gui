## Approach

Extend the capabilities type to accept optional engine version fields, add dev-mode console logging after the handshake, and add a pre-dev npm script for automatic re-bootstrap.

## Data Flow

```
Engine capabilities --json envelope
  → gitCommit, gitDirty, bootstrapTimestamp fields
  → EndstateCapabilitiesData (src/types.ts)
  → App.tsx handshake success path
  → if import.meta.env.DEV: console.log/warn
```

```
npm run tauri dev
  → beforeDevCommand triggers "predev" script
  → powershell endstate.ps1 bootstrap -RepoRoot ../endstate
  → Engine re-bootstrapped (non-fatal)
  → vite dev server starts
```

## Key Decisions

1. **Dev-mode only**: No user-facing UI changes. Version info is only logged to the browser console.
2. **Non-fatal bootstrap**: The predev script suppresses errors so the dev server always starts.
3. **Minimal type changes**: Only add optional fields to existing type, no new types needed.

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `gitCommit?`, `gitDirty?`, `bootstrapTimestamp?` to `EndstateCapabilitiesData` |
| `src/App.tsx` | Add dev-mode console logging after capabilities handshake |
| `package.json` | Add `predev` script |
