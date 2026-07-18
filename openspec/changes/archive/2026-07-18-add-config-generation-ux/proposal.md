## Why

The engine now resolves captured application settings against configuration generations, but the GUI cannot yet present those decisions or collect explicit side-by-side target choices. Users need a safe restore experience that keeps compatibility, migration, legacy handling, and final outcomes owned by the engine.

## What Changes

- Render engine-authored configuration resolution labels, messages, remediation, and terminal statuses for preview and completed setup runs.
- Keep legacy settings usable through the existing restore opt-in and unchecked per-module consent while clearly showing the engine's `legacy_unverified` warning.
- Collect explicit per-capture target choices for engine-reported side-by-side ambiguity and pass them as repeatable `--restore-target` arguments without selecting a default or comparing versions.
- Show engine-authored configuration migration and rollback events as transient progress.
- Expose portable source, target, generation, migration-path, fingerprint, and module-revision provenance through progressive disclosure.
- Preserve engine error messages and remediation for invalid target mappings without rewriting them.

## Capabilities

### New Capabilities

- `config-generation-presentation`: Presentation and invocation behavior for configuration resolutions, explicit target mappings, migration progress, final outcomes, and provenance.

### Modified Capabilities

- `restore-module-approval`: Extend explicit module restore consent to legacy-unverified configuration lanes while retaining unchecked defaults.
- `final-state-from-envelope`: Make completed configuration resolution and migration outcomes authoritative only from the final command envelope.

## Impact

- Additive TypeScript types for the engine's schema-1.0 configuration-resolution and streaming-event fields.
- Setup preview, apply progress, completed result, capability gating, and CLI argument construction in the React/Tauri GUI.
- Unit, component, contract, and browser tests for the new presentation and invocation behavior.
- No provisioning, compatibility, version comparison, migration, or target-selection policy moves into the GUI; engine contracts remain authoritative.
