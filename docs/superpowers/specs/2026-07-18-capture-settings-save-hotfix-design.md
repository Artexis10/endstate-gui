# Capture settings and save hotfix

## Problem

GUI v2.21.1 has two independent production regressions:

1. Its Windows installers contain only `endstate-gui.exe` and `endstate.exe`. The engine module catalog and `SCHEMA_VERSION` resource are absent, so the GUI-launched engine receives an empty `ENDSTATE_ROOT` catalog and reports zero captured settings.
2. After a successful ZIP capture, production immediately deletes the cache ZIP. A later Save or Hosted Backup action then reads or copies a path that no longer exists. Save failures are also mislabeled as scan failures.

## Design

### Capture artifact lifetime

The engine-produced ZIP remains available for the lifetime of the completed capture result. Capture code must not delete a ZIP before Save or Hosted Backup can consume it. Existing startup cache cleanup remains the safety net for abandoned artifacts. A non-ZIP temporary manifest may still be removed after its text has been read.

SaveFlow tracks whether an error came from scanning or saving and renders the matching title. Retrying a save failure returns to the completed result rather than forcing another scan when the capture artifact still exists.

### Packaged engine resources

The release workflow stages the pinned engine repository's `modules/` tree and `SCHEMA_VERSION` into a GUI-owned build directory before Tauri packaging. Tauri packages resources from that deterministic staging directory instead of traversing the nested checkout directly.

Both the ordinary bundle-check workflow and release workflow validate staged inputs before building. The release workflow additionally inspects the generated Windows installers and refuses promotion unless the sidecar, schema version, and expected module catalog are present. The check uses structural invariants rather than merely checking installer filenames.

The runtime engine contract remains unchanged: bundled execution sets `ENDSTATE_ROOT` to the installed `engine/` resource directory. Restoring that directory restores settings detection and display because the existing GUI already passes and renders `configsIncluded` and `configModules`.

## Tests and gates

- A red-first frontend regression test proves ZIP capture output is not deleted before Save consumes it.
- A red-first SaveFlow test proves save errors are labeled `Save failed` and can retry without rescanning.
- A red-first resource-audit test proves an installer with only the two executables is rejected and a catalog-bearing installer inventory is accepted.
- Rust/TypeScript targeted tests and production builds remain green.
- Before release promotion, MSI and NSIS contents must include `endstate.exe`, `SCHEMA_VERSION`, and the engine module catalog.
- A packaged-install smoke test launches the bundled engine with its installed `ENDSTATE_ROOT` and verifies the catalog is usable.

## Release

Ship the fixes together as GUI v2.21.2 with bundled engine v2.24.1. Users install only the GUI installer; no separate engine installation is required.
