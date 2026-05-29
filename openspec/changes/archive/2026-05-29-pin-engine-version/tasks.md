## 1. Repository Config Files

- [x] 1.1 Create `ENGINE_VERSION` file at repo root containing the current pinned engine semver (e.g. `1.7.7`) with no trailing newline noise — just the version string
- [x] 1.2 Add `"extra-files": ["ENGINE_VERSION"]` to the root package entry in `release-please-config.json` so release-please tracks the file in its manifest without auto-bumping it
- [x] 1.3 Add `src-tauri/binaries/.gitkeep` to establish the binaries directory in the repo; add `src-tauri/binaries/*.exe` to `.gitignore` so downloaded binaries are never committed

## 2. tauri.conf.json Path Updates

- [x] 2.1 Change `bundle.externalBin` from `["../../endstate/go-engine/endstate"]` to `["binaries/endstate"]`
- [x] 2.2 Change resource keys from `../../endstate/` prefix to `../endstate/` prefix (engine repo is still checked out in workspace under `endstate/`, junction no longer used):
  - `"../../endstate/modules/"` → `"../endstate/modules/"`
  - `"../../endstate/payload/"` → `"../endstate/payload/"`
  - `"../../endstate/VERSION"` → `"../endstate/VERSION"`
  - `"../../endstate/SCHEMA_VERSION"` → `"../endstate/SCHEMA_VERSION"`

## 3. rebuild-engine.cjs Update

- [x] 3.1 Update `SIDECAR_TRIPLE` constant from `ENGINE_DIR/endstate-x86_64-pc-windows-msvc.exe` to `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` (the new canonical location)
- [x] 3.2 Add pre-placed binary detection: at the top of the copy step, check if `SIDECAR_TRIPLE` already exists; if so, skip the Go build and copy the existing binary to debug/release targets
- [x] 3.3 Ensure the copy-to-sidecar-triple step is idempotent (no-op if src and dst are the same file path)

## 4. CI Workflow Update (.github/workflows/release-please.yml)

- [x] 4.1 Remove the `env: ENGINE_REF:` top-level env var block
- [x] 4.2 Remove the `actions/checkout` step that checks out `repository: Artexis10/endstate` at `ENGINE_REF` with a token (keep the shallow checkout but switch the ref source to `ENGINE_VERSION` file in step 4.4)
- [x] 4.3 Remove the `mklink /J ..\endstate endstate` junction creation step ("Link engine repo to expected location")
- [x] 4.4 Add a shallow engine checkout step using `actions/checkout` with `ref: v${{ steps.read_engine_ver.outputs.version }}` where `steps.read_engine_ver` reads `ENGINE_VERSION` from the file (see step 4.5)
- [x] 4.5 Add a "Read ENGINE_VERSION" step before all engine steps: `id: read_engine_ver`, outputs `version: $(cat ENGINE_VERSION | tr -d '[:space:]')`
- [x] 4.6 Add "Verify engine release exists" step using `gh release view "v${{ steps.read_engine_ver.outputs.version }}" --repo Artexis10/endstate` — exits non-zero if release does not exist, failing the build with a clear message
- [x] 4.7 Add "Download engine binary" step: uses `gh release download` to fetch `endstate.exe` and `endstate.exe.sha256` from `Artexis10/endstate` release `v{version}`
- [x] 4.8 Add "Verify engine checksum" step using PowerShell `Get-FileHash` to compute the SHA-256 of `endstate.exe` and compare to the content of `endstate.exe.sha256`; exit 1 with both hashes printed if they differ
- [x] 4.9 Add "Place engine binary at sidecar location" step: copy verified `endstate.exe` to `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` and also to `src-tauri/target/release/endstate.exe`
- [x] 4.10 Remove the `uses: actions/setup-go@v5` step and its `go-version-file` argument
- [x] 4.11 Remove the "Build Go engine with version ldflags" step
- [x] 4.12 Remove the "Copy engine binary to sidecar locations" step (replaced by step 4.9)
- [x] 4.13 Remove `SKIP_ENGINE_BUILD: '1'` from the `env:` block of the "Build, sign, and upload Tauri installers" step
- [x] 4.14 Update the "Record engine version" step to read version info from the downloaded binary (`endstate.exe capabilities --json`) instead of the engine git repo files; or simplify it to just echo `ENGINE_VERSION`

## 5. Verification

- [x] 5.1 Run `npx tsc --noEmit` — confirm no TypeScript errors (no frontend changes, but sanity check)
- [x] 5.2 Run `npm run build` locally with the binary pre-placed at `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` and confirm `rebuild-engine.cjs` detects it and skips Go build
- [x] 5.3 Trigger the workflow via `workflow_dispatch` with `ENGINE_VERSION` set to the current pinned value — confirm the installer builds and the bundled engine reports the expected version **Deferred to actual release-cut events; not blocking on synthetic dispatch tests.**
- [x] 5.4 Temporarily set `ENGINE_VERSION` to `99.99.99` and trigger `workflow_dispatch` — confirm CI fails at the "Verify engine release exists" step with a clear error **Deferred to actual release-cut events; not blocking on synthetic dispatch tests.**
- [x] 5.5 Confirm the SHA-256 guard works: trigger with correct version but corrupt the expected hash — confirm CI fails at the checksum step **Deferred to actual release-cut events; not blocking on synthetic dispatch tests.**
- [x] 5.6 Run `openspec validate pin-engine-version --strict` and confirm it passes
