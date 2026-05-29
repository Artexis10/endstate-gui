## Tasks

### Task 1: Add engine version fields to EndstateCapabilitiesData
**File**: `src/types.ts`
- Add `gitCommit?: string | null` to `EndstateCapabilitiesData`
- Add `gitDirty?: boolean` to `EndstateCapabilitiesData`
- Add `bootstrapTimestamp?: string | null` to `EndstateCapabilitiesData`

### Task 2: Add dev-mode console logging after capabilities handshake
**File**: `src/App.tsx`
- After successful capabilities handshake (where `capResult.envelope` is set), add dev-mode check
- If `import.meta.env.DEV`, log engine version info or staleness warning
- Log format: `[ENGINE] gitCommit=<commit> dirty=<dirty> bootstrapped=<timestamp>`
- Warning format: `[ENGINE WARNING] No gitCommit in capabilities — likely running stale bootstrapped copy. Consider using script mode or re-bootstrapping.`

### Task 3: Add predev bootstrap script
**File**: `package.json`
- Add `predev` script that invokes `endstate.ps1 bootstrap -RepoRoot ../endstate`
- Must be non-fatal (dev server starts even if bootstrap fails)
