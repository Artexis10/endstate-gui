## MODIFIED Requirements

### Requirement: Dev bypass requires Vite dev mode

The system SHALL skip the license gate only when BOTH conditions are true: Vite dev mode is active AND `VITE_DEV_BYPASS_LICENSE` is set to `'1'`.

#### Scenario: Dev mode with bypass flag skips license gate
- **WHEN** `import.meta.env.DEV` is `true`
- **AND** `import.meta.env.VITE_DEV_BYPASS_LICENSE === '1'`
- **THEN** the license gate SHALL render children immediately without checking license status

#### Scenario: Production build never bypasses license gate
- **WHEN** `import.meta.env.DEV` is `false` (production build)
- **THEN** the license gate SHALL always check license status
- **AND** the bypass flag SHALL have no effect regardless of its value

#### Scenario: Dev mode without bypass flag checks license
- **WHEN** `import.meta.env.DEV` is `true`
- **AND** `import.meta.env.VITE_DEV_BYPASS_LICENSE` is not `'1'`
- **THEN** the license gate SHALL check license status normally
