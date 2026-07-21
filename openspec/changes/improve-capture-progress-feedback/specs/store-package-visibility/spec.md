## ADDED Requirements

### Requirement: GUI inherits complete capture defaults

The GUI SHALL invoke the engine's ordinary capture behavior and SHALL NOT maintain a separate Store-inclusion default, package-source enumerator, or Store toggle.

#### Scenario: User starts capture

- **WHEN** the user starts capture from the Save flow
- **THEN** the GUI invokes capture without a Store-specific include or exclude argument
- **AND** the selected engine version owns which package sources are captured

#### Scenario: Older engine omits Store packages

- **WHEN** the GUI runs against an older engine that does not capture the Store source by default
- **THEN** the GUI displays only the packages and warnings reported by that engine
- **AND** it does not fabricate Store coverage

### Requirement: Store packages retain engine-reported identity

The GUI SHALL display captured Microsoft Store packages from the engine's authoritative result while preserving their reported `msstore` source identity.

#### Scenario: Capture includes a Store package

- **WHEN** the capture envelope includes an app with source `msstore`
- **THEN** the app appears in capture activity and final details as detected
- **AND** the GUI does not classify it as excluded or infer its source from its package ID

### Requirement: Store-source unavailability remains visible and non-fatal

The GUI SHALL surface engine package-source and Store-portability warnings without converting an otherwise successful capture into a failure.

#### Scenario: Community source succeeds and Store source fails

- **WHEN** the capture envelope reports success and includes warning code `store_source_unavailable`
- **THEN** the Save result remains successful
- **AND** the GUI explains that Microsoft Store apps could not be included in this capture
- **AND** detected community-source apps and the produced artifact remain visible

#### Scenario: Community source is unavailable

- **WHEN** the capture envelope reports success and includes warning code `winget_source_unavailable`
- **THEN** the Save result remains successful
- **AND** the GUI explains that community-repository apps could not be included in this capture
- **AND** detected Store apps and the produced artifact remain visible

#### Scenario: Store versions are not portable

- **WHEN** the capture envelope includes warning code `store_version_unpinned`
- **THEN** the GUI explains that affected Store apps were captured for latest-version restoration rather than exact-version restoration
- **AND** the warning does not classify those apps as excluded or failed

#### Scenario: Multiple capture warnings are reported

- **WHEN** the engine returns multiple warning objects with distinct codes and sources
- **THEN** the GUI preserves and displays each distinct warning
- **AND** it does not collapse a source-coverage warning into an unrelated portability warning
