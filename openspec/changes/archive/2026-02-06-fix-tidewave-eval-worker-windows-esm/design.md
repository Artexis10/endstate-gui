## Context

Tidewave's eval_worker.js is forked as a child process to execute arbitrary JavaScript code sent by the Tidewave Web UI and MCP tools. The tidewave package declares `"type": "module"`, so eval_worker.js runs as ESM. On Windows, the Tidewave Web client sends code containing `import()` calls with raw Windows absolute paths (e.g., `C:\Users\...`). Node.js ESM loader requires `file://` URLs for absolute paths, causing `ERR_UNSUPPORTED_ESM_URL_SCHEME`.

## Goals / Non-Goals

**Goals:**
- Fix the ESM import error on Windows so Tidewave Web UI loads without errors
- Ensure the fix survives `npm install` via patch-package
- Preserve existing MCP tool functionality

**Non-Goals:**
- Upstream fix to tidewave package (out of scope; patch is a local workaround)
- Modifying any project source files beyond package.json
- Fixing non-Windows platforms (not affected)

## Decisions

**Decision 1: Regex rewrite of import paths in eval_worker.js**
- Intercept the code string before `new AsyncFunction(code)` execution
- Use regex to find `import('C:\...')` patterns and convert to `import('file:///C:/...')`
- Use Node.js built-in `pathToFileURL()` for correct URL conversion
- *Alternative considered*: Patching vite-plugin.js `executeIsolated` — rejected because the worker is the correct interception point (closest to the error)
- *Alternative considered*: Custom import hook — rejected as over-engineered for this fix

**Decision 2: patch-package for durability**
- Install `patch-package` as devDependency
- Add `"postinstall": "patch-package"` to package.json scripts
- Patch file at `patches/tidewave+0.6.0.patch`
- *Alternative considered*: Manual edit instructions — rejected as fragile and not CI-safe

## Risks / Trade-offs

- **Regex may miss edge cases** → The regex `\bimport\s*\(\s*(['"])([A-Za-z]:\\[^'"]+)\1` covers standard single/double-quoted Windows paths. Template literals are not covered but are not used by the Tidewave client.
- **Patch breaks on tidewave upgrade** → patch-package will warn on version mismatch. When tidewave fixes this upstream, remove the patch.
- **No-op on non-Windows** → The regex only matches Windows drive letter paths, so it's harmless on macOS/Linux.
