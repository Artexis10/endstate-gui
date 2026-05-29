# Design: Pin Engine Version via ENGINE_VERSION File

## Context

**Current state:** CI acquires the engine binary by checking out the full `Artexis10/endstate` source repo, setting up the Go toolchain, and running `go build` with version ldflags. The engine version is pinned by `ENGINE_REF: v1.7.5` in the workflow's `env:` block. A Windows `mklink /J` junction is created one level above the workspace so that `tauri.conf.json`'s `externalBin` path (`../../endstate/go-engine/endstate`, relative to `src-tauri/`) resolves correctly during the Tauri build.

**Problem:** The implicit version and the source-build approach mean:
1. Engine version lives in a workflow YAML env var, not tracked by release-please.
2. Every GUI release depends on Go toolchain availability and a compile step (~2 min on Windows).
3. The junction workaround is Windows-specific CI complexity.
4. An operator bumping the engine version must edit YAML, not a dedicated version file.

**Prerequisite:** `Artexis10/endstate` now publishes `endstate.exe` and `endstate.exe.sha256` as GitHub Release assets at `releases/download/v{VERSION}/endstate.exe`.

## Goals / Non-Goals

**Goals:**
- Single `ENGINE_VERSION` file at repo root is the canonical pin for the bundled engine
- CI downloads the pre-built binary; no Go toolchain required for GUI CI/CD
- SHA-256 checksum is verified; build hard-fails on mismatch or missing asset
- Build fails early if `ENGINE_VERSION` does not correspond to an existing release
- Junction creation step removed from CI
- Local developer workflow preserved (source-build still works when Go is available)
- No change to GUI runtime behavior (invocation, IPC contract, sidecar semantics)

**Non-Goals:**
- Changing the engine's release process or what assets it publishes
- Cross-platform support (GUI releases are Windows-only; download is x86_64-pc-windows-msvc)
- Automatic engine version bumping as part of GUI version bumps

## Decisions

### Decision 1: ENGINE_VERSION file at repo root (not workflow env var)

`ENGINE_VERSION` is a plain-text file containing a single semver string (e.g. `1.7.7`). It is version-controlled, diff-friendly, and read by CI via `$(<ENGINE_VERSION)` (bash) or `Get-Content ENGINE_VERSION` (PowerShell). It appears in `release-please-config.json` `extra-files` so release-please tracks it in the manifest without auto-bumping it.

Alternatives considered:
- Keep `ENGINE_REF` in workflow YAML env — works but is invisible to tooling and changelog; bumping requires YAML edit rather than a clean file change.
- `package.json` custom field — more complex; release-please would try to bump it.

### Decision 2: Move externalBin to src-tauri/binaries/ (standard Tauri convention)

Change `tauri.conf.json` `externalBin` from `../../endstate/go-engine/endstate` (junction-relative, outside workspace) to `binaries/endstate` (standard `src-tauri/binaries/` location, inside workspace). CI downloads the binary and names it `endstate-x86_64-pc-windows-msvc.exe` in `src-tauri/binaries/`. This is the canonical Tauri sidecar convention; Tauri appends the target triple automatically.

Alternatives considered:
- Keep the junction and reuse the old path — preserves tauri.conf.json but carries forward the Windows-junction CI complexity the change is trying to eliminate.
- Intermediate path like `../endstate/go-engine/endstate` (within workspace, no junction) — works for the resource files, but `binaries/` is cleaner and idiomatic.

### Decision 3: Keep shallow engine repo checkout for resource files

`tauri.conf.json` bundles several files from the engine repo (`modules/`, `payload/`, `VERSION`, `SCHEMA_VERSION`) that the bundled binary needs at runtime. Until these assets are published in the engine release, CI still needs a copy. The engine repo is checked out with `--depth 1` at the pinned `ENGINE_VERSION` tag for these files only — no build occurs. Resource paths in `tauri.conf.json` are updated from `../../endstate/` to `../endstate/` (within workspace, junction no longer needed).

Alternatives considered:
- Publish a `modules.zip` from the engine release and download it — would fully eliminate the engine repo checkout; deferred until the engine release process publishes this asset.
- Embed modules in the Go binary — engine-side change; out of scope.

### Decision 4: Hard-fail on checksum mismatch; preflight release existence check

Before downloading, CI calls `gh release view v{ENGINE_VERSION} --repo Artexis10/endstate` (exits non-zero if release does not exist), which is the "CI guard" for non-existent versions. After download, SHA-256 is verified using PowerShell `Get-FileHash`. Any mismatch or missing file exits 1 immediately — no warn-and-continue path.

### Decision 5: Auto-detect pre-placed binary in rebuild-engine.cjs

`rebuild-engine.cjs` is updated to check whether `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` already exists before running the Go build. If found, it skips the compile and copies the binary to the debug/release target paths. This preserves `SKIP_ENGINE_BUILD=1` as an opt-in fast-skip but means CI no longer sets it — the binary is pre-placed by the download step, so the prebuild script detects it automatically.

## Risks / Trade-offs

- **Engine release must be published before GUI release** — If the engine tag v{VERSION} does not exist when the GUI build runs, CI fails at the preflight check. Mitigation: the preflight `gh release view` step gives a clear error message pointing to the missing release.
- **modules/ still requires engine repo checkout** — Until the engine publishes modules as a release asset, a shallow checkout is still required. This means the Go toolchain is removed but the engine checkout remains. Mitigation: the intent is explicit; a follow-up change (`publish-engine-modules-asset`) can eliminate the checkout entirely.
- **SHA-256 file must be published by engine CI** — The download step assumes `endstate.exe.sha256` exists as a release asset. If the engine CI does not produce it, the checksum step fails. Mitigation: engine repo already publishes this per the prerequisite stated in the change request.
- **tauri.conf.json path change could silently break local dev** — Developers running `npm run tauri dev` locally will now need `src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe` to exist. `rebuild-engine.cjs` is updated to copy to this location, so `npm run dev` / `tauri dev` will create it from the local engine repo build. Devs without Go can place the binary manually.

## Migration Plan

1. Create `ENGINE_VERSION` at repo root with current pinned version (`1.7.7`)
2. Update `release-please-config.json` with `extra-files`
3. Update `tauri.conf.json` paths (externalBin + resources)
4. Update `rebuild-engine.cjs` sidecar paths + auto-detection logic
5. Update `.github/workflows/release-please.yml`: replace junction + Go build steps with download + verify step
6. `src-tauri/binaries/.gitkeep` added to establish the directory in the repo
7. Test via `workflow_dispatch` with the existing `ENGINE_VERSION` value; confirm binary version matches
8. Test failure case: temporarily set `ENGINE_VERSION` to `99.99.99` and trigger; confirm CI fails at preflight check

**Rollback:** Revert the PR. All changes are build-time only; no database, no runtime state, no user-visible data is affected.

## Open Questions

- Should the engine repo checkout be removed entirely once the engine publishes modules as a release asset? Tracked as a follow-up; this change documents the intent in a TODO comment in the workflow.
