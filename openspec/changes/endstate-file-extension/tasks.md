# Tasks: endstate-file-extension

## 1. One shared extension module

- [x] 1.1 `src/lib/profile-extensions.ts`: `BUNDLE_EXTENSIONS`, `MANIFEST_EXTENSIONS`,
      `PROFILE_EXTENSIONS`, their dot-less dialog variants, and `DEFAULT_BUNDLE_EXTENSION`
- [x] 1.2 `isBundlePath` / `isManifestPath` / `isSupportedProfilePath`, case-insensitive and
      whitespace-tolerant
- [x] 1.3 Tests for the module, including the `.endstate.jsonc` and bare-word negatives

## 2. Import surface delegates to it

- [x] 2.1 `dropped-profile-import.ts` — `isZipName`/`isManifestName` replaced by the shared
      predicates; both transports now take `.endstate`
- [x] 2.2 `native-profile-drop.ts` — `isSupportedProfilePath` re-exported from the shared module
- [x] 2.3 `schedule-bridge.ts` — `isZipPath` becomes `isBundlePath`, re-exported from the module
- [x] 2.4 `drop-zone.tsx` — `PROFILE_EXTENSIONS` drives `accept` and drop filtering; visible copy
      names `.endstate`
- [x] 2.5 Tests: `.endstate` path and blob transports; case-insensitive match; drop-zone accept
      string and copy; renamed schedule predicate

## 3. Save and browse

- [x] 3.1 Browse dialog filter uses `PROFILE_DIALOG_EXTENSIONS`
- [x] 3.2 Save dialog bundle filter uses `BUNDLE_DIALOG_EXTENSIONS` (`endstate` first)
- [x] 3.3 Default save name, engine cache filename, and browser-download fallback name use
      `DEFAULT_BUNDLE_EXTENSION`
- [x] 3.4 `outputFormat` left as `"zip"` — published contract field naming the container

## 4. Rust layer

- [x] 4.1 `BUNDLE_EXTENSIONS` / `MANIFEST_EXTENSIONS` in `engine-core/src/cmd.rs`
- [x] 4.2 `show_file_dialog`'s PowerShell filter built from them — it previously offered only
      `json/jsonc/json5` and could not pick a bundle at all
- [x] 4.3 `list_manifest_files` reuses `MANIFEST_EXTENSIONS`

## 5. Windows file association

- [x] 5.1 `bundle.fileAssociations` for `endstate` in `tauri.conf.json`
- [x] 5.2 Confirm the vendored `windows/installer.nsi` already drives `APP_ASSOCIATE` and
      `APP_UNASSOCIATE` from that config — no installer edit needed
- [x] 5.3 Confirm the config deserializes (`tauri-build` parses it during `cargo check`; the
      config struct is `deny_unknown_fields`, so a wrong key would fail the build)

## 6. Verification

- [x] 6.1 `npx tsc --noEmit` clean
- [x] 6.2 `npx vitest run` green
- [x] 6.3 `cargo check --workspace --all-targets` clean
- [x] 6.4 `openspec validate --all --strict` green
