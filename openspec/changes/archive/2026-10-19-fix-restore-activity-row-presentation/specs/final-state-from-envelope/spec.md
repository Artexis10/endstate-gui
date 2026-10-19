## ADDED Requirements

### Requirement: Activity rows reconcile into one envelope-authoritative row per item

The GUI SHALL reconcile live activity rows into the completed command envelope's authoritative action list so that each application renders exactly one row across the entire run (plan → apply → verify), even when apply and verify stream in a single spawn. Because the engine keys streamed item events by the package `ref` while envelope actions are keyed by the manifest `id`, the GUI SHALL match a live row to its envelope action by either identifier and collapse them into a single row. Live rows that correspond to no envelope action (for example config-restore rows) SHALL be preserved, not dropped.

#### Scenario: Same app streamed across apply and verify

- **WHEN** an app streams an item event during apply and another during verify, keyed by its package `ref`
- **AND** the completed envelope carries one action for that app keyed by its manifest `id`
- **THEN** the reconciled activity list shows exactly one row for that app
- **AND** the row reflects the envelope's authoritative terminal status

#### Scenario: Package ref differs from manifest id

- **WHEN** a live row is keyed by a package `ref` that differs from its envelope action's `id`
- **THEN** the GUI matches them by `ref` and renders a single row
- **AND** does not render the app twice (once per identifier)

#### Scenario: Restore rows survive reconciliation

- **WHEN** the live list contains config-restore rows that are absent from the envelope's app actions
- **THEN** the reconciled list still contains those restore rows
- **AND** the app rows equal the envelope actions with no residual duplicates
