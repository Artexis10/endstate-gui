## Why

Capture bundles ship as `.endstate` — a zip container behind a first-class extension. A user looking at a profile in the Set up flow has no way to answer "what is actually in this file?" without renaming it to `.zip` or opening it in an archiver. Renaming hands the file back to the shell and away from Endstate, and an archiver answers the wrong question: it shows a file tree, not what the profile will do to the machine.

The question behind "what's inside?" is "what am I about to apply?" — how many apps, which ones, what settings came with them, and when the snapshot was taken. That is answerable from the `manifest.jsonc` already extracted on disk for every profile the Set up flow lists.

## What Changes

- Add a **What's inside** affordance to each profile card in the Set up flow, opening a read-only summary of that profile.
- The summary reports the capture timestamp, the app count and the apps by display name, and the settings modules the profile carries with their file counts.
- Inspection is read-only: opening the summary never selects the profile, never runs a preview, and never changes the machine.
- Everything shown is read from the extracted manifest and its sibling module snapshots. No engine invocation and no zip handling — the deleted `extract_zip_manifest` command is not reinstated.
- Raw module ids, capture ids, the manifest version and the file path stay behind the existing **Configuration details** disclosure, consistent with `config-generation-presentation`.

## Capabilities

### New Capabilities

- `profile-contents-inspection`: A user can see what a capture bundle contains, in product language, without leaving Endstate.

### Modified Capabilities

<!-- None. Existing Set up flow selection, preview, and apply behavior is unchanged. -->

## Impact

- New `src/lib/profile-contents.ts` (manifest summarization) and `src/components/app/intent/profile-contents-modal.tsx` (presentation).
- `src/lib/jsonc-parse.ts` gains the manifest fields the summary needs (`name`, `captured`, `restore`, `configCaptures`, app `displayName`); the existing partial `ProfileManifest` type is extended rather than duplicated.
- `src/components/app/intent/setup-flow.tsx` renders the affordance and owns the open/closed state.
- No engine, envelope, Tauri command, manifest-format, or dependency change. The summary reuses the already-registered `read_text_file` command.
