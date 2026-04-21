## 1. Rewrite the `build` job in release-please.yml

- [x] 1.1 Replace the hand-rolled `npm ci` + `npm run tauri build` + `softprops/action-gh-release@v2` sequence with a single `tauri-apps/tauri-action@v0` step
- [x] 1.2 Preserve the preceding steps verbatim: checkout GUI, checkout engine (`Artexis10/endstate` at `ENGINE_REF`), junction-link engine, create empty payload, setup Go/Node/Rust, build Go engine with ldflags, copy binary to sidecar triple + `src-tauri/target/release/`
- [x] 1.3 Pass `SKIP_ENGINE_BUILD=1` to the `tauri-action` step so the already-built Go binary is reused and the `prebuild` script does not rebuild it

## 2. Wire signing environment

- [x] 2.1 Expose `TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}` on the `tauri-action` step
- [x] 2.2 Expose `TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}` on the same step

## 3. Upload signed artifacts to the created release

- [x] 3.1 Pass the release tag/ID from the `release-please` job output into `tauri-action`'s `tagName` (or `releaseId`) input so it uploads to the release release-please just created
- [x] 3.2 Confirm `tauri-action` uploads both bundles and their `.sig` siblings as release assets (default behavior when signing env is set)
- [x] 3.3 Delete the standalone `softprops/action-gh-release@v2` upload step (replaced by tauri-action's upload)

## 4. Workflow hygiene

- [x] 4.1 Keep the release-please job, ENGINE_REF comment block, engine junction-link step, and payload-directory creation step unchanged
- [x] 4.2 Do not alter workflow triggers (`push: main`, `workflow_dispatch`)
- [x] 4.3 Do not alter `permissions:` beyond what tauri-action documents as needed (`contents: write` is already granted)

## 5. Out-of-band operator prerequisites (done before this PR merges)

- [x] 5.1 Operator: run keypair generation per `docs/runbooks/UPDATER_SETUP.md`
- [x] 5.2 Operator: populate GH Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [x] 5.3 Operator: replace the placeholder `REPLACE_WITH_ACTUAL_PUBLIC_KEY` in `src-tauri/tauri.conf.json` with the generated pubkey (landed on PR #18)

## 6. Verification (post-merge, on next real release)

- [ ] 6.1 Trigger the release workflow by creating a release-please PR and merging it to main
- [ ] 6.2 Confirm the `build` job's tauri-action step succeeds (or fails loudly if secrets are missing — the desired surface)
- [ ] 6.3 Open the created GitHub Release and confirm four assets: `*.exe`, `*.exe.sig`, `*.msi`, `*.msi.sig`
- [ ] 6.4 Download an `.exe` and its `.sig`, run `npx @tauri-apps/cli signer verify` locally to confirm the signature validates against the committed pubkey
