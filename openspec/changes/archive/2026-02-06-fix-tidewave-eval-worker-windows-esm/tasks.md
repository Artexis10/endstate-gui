## 1. Patch eval_worker.js

- [x] 1.1 Add `fixWindowsImportPaths` function using `pathToFileURL` to convert Windows paths in `import()` calls to `file://` URLs
- [x] 1.2 Apply `fixWindowsImportPaths` to code before `new AsyncFunction(code)` execution

## 2. Persist patch via patch-package

- [x] 2.1 Install `patch-package` as devDependency
- [x] 2.2 Run `npx patch-package tidewave` to create `patches/tidewave+0.6.0.patch`
- [x] 2.3 Add `"postinstall": "patch-package"` to package.json scripts

## 3. Verification

- [x] 3.1 Confirm `npm run dev:tidewave` starts without errors
- [x] 3.2 Confirm `project_eval` with Windows path import succeeds (no ESM error)
- [x] 3.3 Confirm MCP tools (`get_docs`, `get_source_location`) still work
- [x] 3.4 Confirm Tidewave Web UI at `/tidewave` loads without "Could not connect" error
- [x] 3.5 Confirm `patches/tidewave+0.6.0.patch` exists
