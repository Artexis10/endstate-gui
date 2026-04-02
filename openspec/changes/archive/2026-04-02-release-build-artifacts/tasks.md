## 1. Workflow Infrastructure

- [x] 1.1 Change runner from `ubuntu-latest` to `windows-latest` and set `shell: bash` on shell steps
- [x] 1.2 Add `actions/checkout` step for `Artexis10/endstate` repo at path `../endstate`
- [x] 1.3 Add toolchain setup steps: `actions/setup-go`, `actions/setup-node` (Node 20), `dtolnay/rust-toolchain` (stable)

## 2. Engine Build

- [x] 2.1 Add step to read `VERSION` and `SCHEMA_VERSION` from engine repo and build Go engine with `-ldflags` embedding both values
- [x] 2.2 Add step to copy engine binary to triple-named sidecar location (`endstate-x86_64-pc-windows-msvc.exe`) and `src-tauri/target/release/endstate.exe`

## 3. Tauri Build

- [x] 3.1 Add `npm ci` step
- [x] 3.2 Add `npm run tauri build` step with `SKIP_ENGINE_BUILD=1` environment variable

## 4. Artifact Attachment

- [x] 4.1 Update `softprops/action-gh-release` step to attach NSIS (`src-tauri/target/release/bundle/nsis/*.exe`) and MSI (`src-tauri/target/release/bundle/msi/*.msi`) files via `files` parameter
