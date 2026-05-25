# Releasing endstate-gui

## How releases fire automatically

1. Conventional commits land on `main` (e.g. `feat:`, `fix:`).
2. `release-please-action` (in `.github/workflows/release-please.yml`) opens or updates a release PR titled `chore(main): release gui X.Y.Z`.
3. Merging that PR creates tag `gui-vX.Y.Z` and a GitHub Release with the changelog.
4. The `build` job of the same workflow runs on `windows-latest`:
   - Reads `ENGINE_VERSION` at the repo root.
   - Verifies `vX.Y.Z` release exists on [`Artexis10/endstate`](https://github.com/Artexis10/endstate/releases).
   - Downloads `endstate.exe` and `endstate.exe.sha256` from that release.
   - Verifies the SHA-256, places the binary at the Tauri sidecar location.
   - Calls `tauri-apps/tauri-action@v0` to build, sign, and upload `.msi`, `.exe`, and `latest.json` to the GUI release.
5. A final step asserts `latest.json` is present — if missing, the run fails loudly.

## The engine pin contract

`ENGINE_VERSION` (a single line at the repo root, e.g. `2.1.0`) must reference an `Artexis10/endstate` release that has **both** `endstate.exe` and `endstate.exe.sha256` attached. The build will fail at the download step if either is missing.

Two guards enforce this contract:

- **`engine-drift-check.yml`** (daily cron): refuses to open the auto-bump PR when the latest engine release lacks required assets.
- **`verify-engine-pin.yml`** (PR check on `ENGINE_VERSION` changes): fails the PR check on any change to `ENGINE_VERSION` that points at a binary-less engine release. Make this a required status check in branch protection so it actually blocks merges.

## What to do if a release ships without installers

Symptom: a `gui-vX.Y.Z` release page has only "Source code (zip/tar.gz)" — no `.msi`/`.exe`/`latest.json`.

Diagnose:

```bash
gh run list --workflow=release-please.yml --limit 5
gh run view <run-id> --log-failed | head -100
```

The most common cause is the engine pin pointing at a release without binaries. Fix in `Artexis10/endstate`:

```bash
# Build the engine binary at the pinned tag, then:
gh release upload v<VERSION> endstate.exe endstate.exe.sha256 \
  --repo Artexis10/endstate --clobber
gh release view v<VERSION> --repo Artexis10/endstate \
  --json assets --jq '.assets[].name'   # confirm both files listed
```

Then re-trigger this repo's build (no re-tagging needed):

```bash
gh workflow run release-please.yml \
  --repo Artexis10/endstate-gui \
  --ref main \
  --field tag_name=gui-v<VERSION>
gh run watch --repo Artexis10/endstate-gui
```

Confirm assets:

```bash
gh release view gui-v<VERSION> --json assets --jq '.assets[].name'
# Expect: Endstate_X.Y.Z_x64-setup.exe, Endstate_X.Y.Z_x64_en-US.msi, latest.json, .sig files
```

## Manual re-trigger reference

The `workflow_dispatch` trigger on `release-please.yml` (input: `tag_name`) is the one-stop manual handle. The `release-please` job will no-op when no new release is needed; the `build` job runs anyway because of the `workflow_dispatch` arm of its `if:` condition. Use the same command to rebuild any past tag against its current `ENGINE_VERSION` pin.
