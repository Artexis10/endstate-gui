## Why

Tidewave Web UI at `/tidewave` shows "Could not connect to your app" on Windows because the eval worker runs as ESM (tidewave has `"type": "module"`) and dynamic `import()` calls use raw Windows paths (`C:\...`) instead of `file://` URLs. Node.js ESM loader rejects these with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. MCP tools work because they send simple expressions, but the Web UI sends code with absolute path imports that trigger the failure.

## What Changes

- Patch `tidewave@0.6.0` eval_worker.js to convert Windows absolute paths in dynamic `import()` calls to `file://` URLs before execution
- Add `patch-package` as devDependency with `postinstall` script so the fix survives `npm install`
- No project source files modified beyond `package.json` scripts

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- **Files modified**: `package.json` (postinstall script, patch-package devDep)
- **Files added**: `patches/tidewave+0.6.0.patch`
- **Dependencies**: `patch-package` added as devDependency
- **No project source code changes** — fix is entirely within the tidewave patch
- **No production impact** — tidewave is a devDependency only
