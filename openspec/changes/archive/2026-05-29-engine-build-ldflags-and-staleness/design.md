## Approach

Extend the existing `scripts/rebuild-engine.cjs` with three changes: (1) compile-time version embedding via ldflags, (2) staleness guard against origin/main, and (3) removal of the dead VERSION file fallback.

## Data Flow

```
Engine repo root (path.resolve(ENGINE_DIR, '..'))
  → Read VERSION file → ver string (e.g. "1.7.2")
  → Read SCHEMA_VERSION file → schemaVer string (e.g. "1.0.0")
  → Compose ldflags: -X config.version=<ver> -X config.schemaVersion=<schemaVer>
  → go build -ldflags "<ldflags>" -o endstate.exe ./cmd/endstate/
  → Binary has version baked in at compile time
  → capabilities --json returns correct cliVersion/schemaVersion
```

```
Staleness guard (before go build):
  → git fetch origin main --quiet (15s timeout)
  → git log HEAD..origin/main --oneline
  → If commits exist:
    → STRICT_ENGINE_BUILD=1: hard error with count + remediation
    → Otherwise: warning, continue
  → If git fetch fails (offline): warn, continue
```

## Key Decisions

1. **Ldflags target packages**: `-X github.com/Artexis10/endstate/go-engine/internal/config.version=<ver>` and `-X ...config.schemaVersion=<schemaVer>`. These are the Go variables the engine reads at runtime.
2. **VERSION files location**: `path.resolve(ENGINE_DIR, '..')` — the engine repo root is one level above the `go-engine/` directory that `ENGINE_DIR` points to.
3. **Staleness check position**: Runs after reading VERSION files but before `go build`, so a stale repo is caught before spending time compiling.
4. **Git fetch timeout**: 15 seconds — long enough for typical networks, short enough to not stall CI.
5. **VERSION fallback removal**: The catch block in Step 3 that reads `../../VERSION` is removed. With ldflags, capabilities extraction should always return the correct version. The catch block now just logs a warning and leaves cliVersion as 'unknown'.

## Risks

| Risk | Mitigation |
|------|------------|
| Forgetting ldflags in a new build script | Capabilities extraction (Step 3) still verifies the output — a missing version would show as 'unknown' and be visible in the console |
| VERSION/SCHEMA_VERSION files missing | Script will throw a clear error at the fs.readFileSync call before attempting go build |
| git fetch hanging | 15-second timeout on execSync prevents indefinite blocking |

## Files Changed

| File | Change |
|------|--------|
| `scripts/rebuild-engine.cjs` | Add ldflags to go build, add staleness guard, remove VERSION fallback |
