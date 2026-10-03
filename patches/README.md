# Patches

Applied automatically via `postinstall: "patch-package"`.

## `tidewave+0.6.0.patch` - Tidewave Windows path bug

Windows ESM path fix for `eval_worker.js` (used by both the Vite plugin and the Tidewave CLI). `patches/tidewave+0.6.0.patch` fixes `eval_worker.js` where `import()` with bare Windows paths (`C:\...` or `C:/...`) causes `ERR_UNSUPPORTED_ESM_URL_SCHEME` because Node's ESM loader interprets `C:` as a URL protocol. The upstream code has no Windows path handling at all. The patch adds two layers: (1) a `module.register()` ESM resolve hook that intercepts **all** dynamic imports (including `import(path.join(cwd, ...))` where the path is computed at runtime), converting Windows paths to `file:///` URLs; (2) a regex-based `fixWindowsImportPaths()` that rewrites string-literal paths in eval code text as a belt-and-suspenders fallback. **When upgrading tidewave**, check if the upstream `eval_worker.js` has Windows path handling; if so, remove the patch. If not, regenerate: copy the patch's `import { register }` block and `fixWindowsImportPaths` function into `node_modules/tidewave/dist/evaluation/eval_worker.js`, then run `npx patch-package tidewave`.
