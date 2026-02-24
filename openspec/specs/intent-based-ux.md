# Intent-Based UX (ADR-001)

## Purpose

Replace the dashboard UX with a binary intent model. The app opens to a full-viewport mode selector: **Save this computer** or **Set up this computer**. Each mode transitions into a dedicated full-screen flow. This spec replaces the current dashboard UX model.

## Decision Reference

See `docs/decisions/001-intent-based-ux-redesign.md` for architectural rationale.

## Contract References

All flows respect:
- `docs/ux-guardrails.md` — No hidden state, no auto-restore, no jargon
- `docs/ux-principles.md` — Non-technical first, progressive disclosure, safety
- `docs/ux-language.md` — Status/phase semantics unchanged
- `docs/config-export-restore-ux.md` — Config restore OFF by default
- `docs/profile-contract.md` — Profile discovery and validation unchanged
- `docs/ux-engine-contract.md` — GUI is thin layer, CLI is truth

## Requirements

### Requirement: Landing screen is a binary intent selector

The system SHALL present a full-viewport landing screen with two interactive regions: "Save this computer" and "Set up this computer". No sidebar, no navigation chrome.

#### Scenario: App opens to landing screen
- **WHEN** the app starts
- **THEN** the user sees two large interactive regions filling the viewport
- **AND** no sidebar or navigation chrome is visible

#### Scenario: User selects Save intent
- **WHEN** the user clicks "Save this computer"
- **THEN** the app transitions to the Save flow view

#### Scenario: User selects Set up intent
- **WHEN** the user clicks "Set up this computer"
- **THEN** the app transitions to the Set up flow view

### Requirement: Save flow is stateless guided capture

The Save flow SHALL be a stateless guided capture flow: scan machine, curate selection, produce zip bundle. No in-GUI capture history. No capture library. Session-scoped result display only.

#### Scenario: Save flow produces zip bundle
- **WHEN** the user completes the Save flow
- **THEN** a zip bundle is produced containing manifest plus config exports
- **AND** the user gets a save dialog to choose where to put the zip
- **AND** leaving the flow clears session state

#### Scenario: Save flow has no capture history
- **WHEN** the user returns to the landing screen from Save
- **THEN** session state is cleared
- **AND** no capture history is shown anywhere in the UI

### Requirement: Set up flow presents import and profile management

The Set up flow SHALL present a drop zone for zip/manifest import alongside a list of existing profiles. Profiles persist on disk.

#### Scenario: Drop zone accepts zip bundles
- **WHEN** the user drops a zip bundle on the drop zone
- **THEN** the zip is unpacked to Documents/Endstate/Profiles/
- **AND** the profile list updates to show the imported profile

#### Scenario: Drop zone accepts bare manifest files
- **WHEN** the user drops a .jsonc manifest file on the drop zone
- **THEN** the file is copied to Documents/Endstate/Profiles/
- **AND** the profile list updates to show the imported profile

#### Scenario: Profile list shows all discovered profiles
- **WHEN** the Set up flow is displayed
- **THEN** the profile list shows all valid profiles from Documents/Endstate/Profiles/
- **AND** manually placed folders and bare manifests are discovered

#### Scenario: Profile management lives in Set up flow
- **WHEN** the user interacts with a profile card
- **THEN** contextual actions are available: rename, delete, inspect
- **AND** selecting a profile leads to the apply flow

### Requirement: Back navigation returns to landing

The user SHALL always be able to return to the landing screen from either flow.

#### Scenario: Back from Save clears session state
- **WHEN** the user navigates back from Save flow
- **THEN** the landing screen is shown
- **AND** any in-progress capture session state is cleared

#### Scenario: Back from Set up preserves profile list
- **WHEN** the user navigates back from Set up flow
- **THEN** the landing screen is shown
- **AND** the profile list state is preserved (profiles persist on disk)

### Requirement: Zip is the portable artifact format

Zip bundles SHALL be the primary transport and sharing format. Engine stays folder-based internally (Model A).

#### Scenario: Zip contains manifest plus config data
- **WHEN** a zip bundle is produced by capture
- **THEN** it contains the manifest plus all configuration data necessary for complete machine reconstruction

#### Scenario: Import unpacks zip to profiles directory
- **WHEN** a zip is imported via the Set up flow
- **THEN** it is unpacked to Documents/Endstate/Profiles/
- **AND** the result is a regular profile folder indistinguishable from any other

### Requirement: Capture management is archived

The existing capture management system (history, re-export, capture library) SHALL be removed from the active UX. Code stays in git history.

#### Scenario: No capture history in UI
- **WHEN** the user navigates the app
- **THEN** no capture history, capture library, or re-export surfaces are visible

## Constraints (Non-Negotiable)

1. GUI is thin presentation layer — no business logic
2. CLI is source of truth for all operations
3. No hidden state — all state visible and inspectable
4. Profiles live in Documents/Endstate/Profiles/
5. Config restore OFF by default
6. No secrets handling
7. All GUI actions reproducible via CLI
8. JSON envelope contract unchanged
9. Event contract unchanged
10. Status/phase semantics unchanged

## Implementation References

- `src/components/app/intent/` — New intent-based components
- `src/components/app/overview/` — Archived overview components (ADR-001)
- `src/App.tsx` — Page routing with intent-based navigation
- `src/components/layout/app-shell.tsx` — Shell supporting landing mode

## Test Coverage

- Unit tests for IntentLanding component rendering and navigation
- Unit tests for DropZone component file acceptance
- Integration tests for flow transitions
