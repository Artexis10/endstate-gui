## Why

The release workflow creates GitHub Releases when `gui-v*` tags are pushed, but only attaches source code archives — no built installer. Customers and SignPath (code signing) require actual `.msi`/`.exe` artifacts on each release.

## What Changes

- Add a Windows build job to the release workflow that builds the Go engine with version ldflags, runs `tauri build`, and produces NSIS (`.exe`) and MSI (`.msi`) installers
- Attach both installer artifacts to the GitHub Release alongside the existing changelog body
- Checkout the engine repo (`endstate`) alongside the GUI repo in CI to provide sidecar binary and bundled resources
- Set up Go, Node 20, and Rust stable toolchains in the workflow

## Capabilities

### New Capabilities

### Modified Capabilities
- `auto-release`: Adds Windows installer build and artifact attachment to the existing tag-triggered release workflow

## Impact

- Modified file: `.github/workflows/release.yml`
- No application code changes
- Requires `windows-latest` runner (GitHub-hosted, free for public repos)
- Engine repo (`Artexis10/endstate`) checked out via `actions/checkout` with PAT or default token
