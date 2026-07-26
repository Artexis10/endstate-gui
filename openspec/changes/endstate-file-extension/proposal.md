# Proposal: endstate-file-extension

## Why

The capture bundle is the artifact Endstate exists to produce, and in the GUI it has always been a
`.zip`. That name costs recognition (a `.zip` in Downloads looks like every other archive), it
costs the double-click (Windows cannot route `.zip` to Endstate — the shell owns it), and it makes
the product's own output look like a shipping detail rather than a format.

The engine change (Artexis10/endstate) gives bundles a first-class `.endstate` extension. This is
the GUI half: accept it everywhere, offer it in every picker, and register it with Windows so
double-clicking one opens Endstate.

`.endstate` is a rename, not a new format — the same zip container with `manifest.jsonc` at its
root. A bundle renamed back to `.zip` still opens in any archiver, and that transparency is
deliberate: "your setup is not locked inside our tool" is only credible if the artifact stays
inspectable with tools the user already has. No obfuscation is added.

## What Changes

- **One shared extension module, `src/lib/profile-extensions.ts`.** The recurring bug class here
  is a duplicated rule drifting apart: the drop zone, the import transport, the native drag
  handler, the schedule baseline check, and two dialog filters each carried their own copy of "is
  this a zip?". Adding an extension meant finding all of them, and missing one produced a file the
  app accepted in one place and silently ignored in another. All of them now import
  `BUNDLE_EXTENSIONS` / `isBundlePath` / `isSupportedProfilePath` from one place.
- **`.endstate` accepted everywhere `.zip` is**, case-insensitively: drop zone (drag, drop, and the
  hidden file input's `accept`), native Tauri path drops, the base64 browser fallback, the browse
  dialog, and the schedule baseline predicate.
- **`.zip` keeps working, permanently.** Back-compat with no sunset.
- **Saved captures default to `.endstate`.** The save dialog offers `endstate` first and `zip`
  second; the engine cache filename and the browser-download fallback name follow.
- **A matching Rust-side pair of extension lists** in `engine-core/src/cmd.rs`, used to build the
  PowerShell `OpenFileDialog` filter — which listed only `json/jsonc/json5` and so could never pick
  a bundle at all.
- **Windows file association** via `bundle.fileAssociations` in `tauri.conf.json`. The vendored
  NSIS template already drives `APP_ASSOCIATE` / `APP_UNASSOCIATE` from that config, so registering
  and cleanly unregistering the type needs no installer edit.
- **Double-clicking a bundle imports it.** The association is only worth having if opening a file
  does something: an association that launches the app and then ignores the file the user opened is
  worse than no association, because the user has no way to tell whether it worked. The path
  arrives in `argv` — on a cold start from the process arguments, on a warm start from the
  single-instance callback — and both routes end in the same import the drag-drop handler runs.

`schedule-bridge`'s `isZipPath` is renamed to `isBundlePath` and re-exported from the shared
module. It is internal to the app, not a published API.

## Capabilities

### New Capabilities
- `endstate-file-extension`: the GUI accepts, writes, and registers `.endstate` capture bundles
  while keeping `.zip` working.

### Modified Capabilities
<!-- none — import, capture, and schedule behaviour are otherwise unchanged -->

## Impact

- `src/lib/profile-extensions.ts` (new) — the single definition, plus its tests.
- `src/lib/dropped-profile-import.ts`, `src/lib/native-profile-drop.ts`,
  `src/lib/schedule-bridge.ts` — predicates now delegate to it.
- `src/components/app/intent/drop-zone.tsx` — accepted extensions and the visible copy.
- `src/App.tsx` — browse filter, save filter, default save name, cache filename, schedule guard.
- `src-tauri/engine-core/src/cmd.rs` — `BUNDLE_EXTENSIONS` / `MANIFEST_EXTENSIONS`, dialog filter.
- `src-tauri/tauri.conf.json` — `bundle.fileAssociations`.
- `src/lib/opened-profile-files.ts` (new) — the pure `argv` → import decision, plus its tests.
- `src/lib/native-profile-drop.ts` — the drop handler's import tail becomes the shared
  `beginProfileImport`, so the opened-file route cannot drift from it.
- `src-tauri/src/lib.rs` — parks launch `argv`, exposes `take_opened_file_args`, and emits
  `endstate://opened-files` from the single-instance callback.
- **Producer (separate `endstate` change):** the engine writes `.endstate` by default and accepts
  it wherever it accepts `.zip`.
- Backward-compatible: an older bundled engine that still writes `.zip` is unaffected — the GUI
  copies from the envelope's `outputPath`, whatever it is named.

## Non-goals

- **Associating `.endstate` on macOS or Linux.** `fileAssociations` is declared for the Windows
  installer only, which is the shipped desktop target.
- **A distinct "opened file" experience.** An opened bundle deliberately reuses the drop flow
  wholesale — same Set up navigation, same busy refusal, same error reporting — rather than growing
  a second import UX to keep in sync.
- **Changing `outputFormat`.** It stays `"zip"`: it names the container, which did not change, and
  it is a published cross-repo contract field.
