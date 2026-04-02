## Context

The release workflow (`.github/workflows/release.yml`) currently runs on `ubuntu-latest`, extracts a changelog section, and creates a GitHub Release with no binary artifacts. The GUI is a Tauri app targeting Windows, so installers must be built on a Windows runner. The Go engine binary is a sidecar that must be compiled with version ldflags and placed at the correct path before `tauri build`.

Key constraints from `tauri.conf.json`:
- `externalBin`: `../../endstate/go-engine/endstate` (expects engine repo two directories up)
- `resources`: `../../endstate/modules/`, `../../endstate/payload/`, `../../endstate/VERSION`, `../../endstate/SCHEMA_VERSION`
- `beforeBuildCommand`: `npm run build` (triggers `predev` → `rebuild-engine.cjs`)
- Bundle targets: NSIS installer + MSI

## Goals / Non-Goals

**Goals:**
- Build Windows NSIS and MSI installers in CI on every tagged release
- Attach installer artifacts to the GitHub Release
- Build the Go engine with version ldflags (matching local `rebuild-engine.cjs` behavior)
- Preserve existing changelog extraction and release creation logic

**Non-Goals:**
- macOS or Linux builds (Windows-only for now)
- Code signing via SignPath (future work — artifacts are unsigned for now)
- Caching Rust/Go/npm dependencies (optimize later if build times are problematic)
- Changing the trigger or release-please integration

## Decisions

### Single job on `windows-latest`

Merge the build and release into one job on `windows-latest`. The existing changelog extraction uses `awk` which is available on GitHub's Windows runners via Git Bash. This avoids artifact upload/download between jobs and keeps the workflow simple.

**Alternative considered:** Separate Linux job for changelog + Windows job for build. Rejected because it adds inter-job coordination complexity for no benefit — `awk` and shell commands work fine on Windows runners.

### Checkout engine repo alongside GUI

Use `actions/checkout` with `repository: Artexis10/endstate` and `path: ../endstate` so the relative paths in `tauri.conf.json` resolve correctly without any config changes. The engine repo is public (or use `GITHUB_TOKEN` for private access).

**Alternative considered:** Fetch a pre-built engine binary from a separate release. Rejected because it adds a dependency ordering problem and the engine doesn't have its own release pipeline yet.

### Build engine explicitly, then `SKIP_ENGINE_BUILD=1` for tauri build

Build the engine with `go build -ldflags ...` in a dedicated step, copy the triple-named sidecar binary, then set `SKIP_ENGINE_BUILD=1` so the `beforeBuildCommand` (`npm run build` → `rebuild-engine.cjs`) skips the redundant Go build. This gives us explicit control over the engine build step and clear error reporting.

### Glob pattern for installer attachment

Use `softprops/action-gh-release` `files` parameter with glob patterns to attach:
- `src-tauri/target/release/bundle/nsis/*.exe` (NSIS installer)
- `src-tauri/target/release/bundle/msi/*.msi` (MSI installer)

## Risks / Trade-offs

- **Windows runner cost** → GitHub-hosted `windows-latest` has higher per-minute cost than `ubuntu-latest`. Mitigated by this only running on tag pushes (infrequent).
- **Engine repo access in CI** → If the engine repo is private, `GITHUB_TOKEN` won't have cross-repo access. Mitigation: use a PAT stored as a secret (`ENGINE_REPO_TOKEN`), or make the engine repo public.
- **`awk` on Windows runner** → GitHub Windows runners include Git Bash, but the `run:` shell defaults to PowerShell. Mitigation: set `shell: bash` on steps that use `awk`/shell.
- **Unsigned binaries** → Without SignPath integration, Windows Defender SmartScreen will warn users. Acceptable for now; signing is a follow-up.
