## Why

The GUI sidecar binary at `src-tauri/target/debug/endstate.exe` frequently goes stale because it was only copied, never rebuilt. Every engine change required a manual `go build` + copy step. Forgetting this caused silent failures — the GUI would run old engine code with no indication anything was wrong.

## What Changes

- **Replace** the inline `predev` one-liner in `package.json` with `node scripts/rebuild-engine.js`
- **Add** `scripts/rebuild-engine.js` that runs `go build` in the engine repo, then copies the binary to both the sidecar triple location and `src-tauri/target/debug/`
- **Add** `SKIP_ENGINE_BUILD=1` env var to bypass the build step for rapid frontend iteration
- **Add** `ENDSTATE_ENGINE_DIR` env var to override the engine repo location
- **Update** `PROJECT_SHADOW.md` with a new landmine entry documenting this behavior

## Capabilities

### New Capabilities
- `predev-auto-rebuild`: Automatically rebuilds the Go engine binary before dev server starts

### Modified Capabilities
- `predev`: Changed from copy-only to build-then-copy. Gracefully degrades if Go toolchain is unavailable.

## Impact

- **Build scripts**: `package.json` (predev script), new `scripts/rebuild-engine.js`
- **Documentation**: `docs/ai/PROJECT_SHADOW.md` (new landmine entry)
- **Dependencies**: Go toolchain used at dev time (optional — degrades gracefully)
- **Existing tests**: No test changes needed — this is a dev tooling change
