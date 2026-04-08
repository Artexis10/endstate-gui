# License Gate

## Purpose

Gate the GUI behind license key activation. The GUI requires a valid checkout provider license key tied to a machine fingerprint. Unlicensed users see an activation screen; licensed users proceed to the app. Offline use is supported via cached validation. Development builds can bypass the gate entirely.

## Requirements

### Requirement: Machine fingerprint is deterministic and machine-bound
The system SHALL compute a SHA-256 fingerprint from three Windows registry/system values to identify the machine.

#### Scenario: Fingerprint composition
- **GIVEN** a Windows machine with registry access
- **WHEN** the system computes a machine fingerprint
- **THEN** it hashes the concatenation of `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`, the computer hostname, and `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\InstallDate` (as little-endian u32 bytes) using SHA-256
- **AND** returns a 64-character lowercase hex string

#### Scenario: Fingerprint is deterministic
- **WHEN** the fingerprint is computed twice on the same machine
- **THEN** both results are identical

### Requirement: Activation calls checkout provider API
The system SHALL activate a license key by calling the checkout provider `/v1/licenses/activate` endpoint with the license key and machine fingerprint as instance name.

#### Scenario: Successful activation
- **WHEN** checkout provider returns `activated: true` with an `instance.id`
- **THEN** the system persists a cache file with key, instance ID, fingerprint, and activation timestamp
- **AND** returns `LicenseStatus` with `activated: true`

#### Scenario: Failed activation
- **WHEN** checkout provider returns `activated: false` or an error
- **THEN** no cache is written
- **AND** returns `LicenseStatus` with `activated: false` and the error in `validationError`

### Requirement: License cache persists to disk
The system SHALL store license data at `%APPDATA%/Endstate/license.json` using camelCase JSON fields: `key`, `instanceId`, `fingerprint`, `activatedAt`.

#### Scenario: Cache written on activation
- **WHEN** activation succeeds
- **THEN** the cache file is created (with parent directory) containing the license data

#### Scenario: Cache deleted on deactivation
- **WHEN** deactivation succeeds
- **THEN** the cache file is removed from disk

#### Scenario: Cache deleted on remote invalidation
- **WHEN** online validation returns `valid: false`
- **THEN** the cache file is removed from disk

### Requirement: License check validates fingerprint and calls API
The system SHALL check license status by reading the cache, verifying the fingerprint matches the current machine, and validating online with checkout provider.

#### Scenario: No cache exists
- **WHEN** no cache file exists at the expected path
- **THEN** returns `LicenseStatus` with `activated: false` (no error)

#### Scenario: Fingerprint mismatch
- **WHEN** cache exists but the stored fingerprint does not match the current machine's fingerprint
- **THEN** returns `LicenseStatus` with `activated: false` and `validationError: "License was activated on a different machine"`

#### Scenario: Online validation succeeds
- **WHEN** cache exists, fingerprint matches, and checkout provider returns `valid: true`
- **THEN** returns `LicenseStatus` with `activated: true`

#### Scenario: Online validation fails
- **WHEN** cache exists, fingerprint matches, but checkout provider returns `valid: false`
- **THEN** deletes the cache file
- **AND** returns `LicenseStatus` with `activated: false` and the error in `validationError`

#### Scenario: Offline grace
- **WHEN** cache exists, fingerprint matches, but the checkout provider API is unreachable
- **THEN** trusts the cache and returns `LicenseStatus` with `activated: true`

### Requirement: Deactivation calls checkout provider API
The system SHALL deactivate by calling `/v1/licenses/deactivate` with the cached key and instance ID.

#### Scenario: Successful deactivation
- **WHEN** checkout provider returns `deactivated: true`
- **THEN** the cache file is deleted
- **AND** returns success

#### Scenario: No active license
- **WHEN** deactivation is attempted with no cache file
- **THEN** returns an error: "No active license to deactivate"

### Requirement: GUI gate blocks app when unlicensed
The system SHALL wrap the entire application in a `LicenseGate` component that checks license status on mount and either renders the app (activated) or an activation screen (not activated).

#### Scenario: Checking state
- **WHEN** the gate is mounted and license check is in progress
- **THEN** a centered loading spinner is displayed

#### Scenario: Unlicensed
- **WHEN** license check returns `activated: false`
- **THEN** an activation card is displayed with a key input field, activate button, and "Buy Endstate" link to `https://checkout.example.com`

#### Scenario: Licensed
- **WHEN** license check returns `activated: true`
- **THEN** the children (full app) are rendered
- **AND** a `LicenseGateContext` is provided with the status and a deactivation callback

#### Scenario: Activation error
- **WHEN** activation returns `activated: false` with a `validationError`
- **THEN** the error is displayed below the key input field

#### Scenario: Deactivation from settings
- **WHEN** the `onDeactivated` callback from `LicenseGateContext` is invoked
- **THEN** the gate resets to the activation screen (key input cleared, error cleared, status set to inactive)

### Requirement: Dev bypass
The system SHALL skip the license gate entirely when `VITE_DEV_BYPASS_LICENSE` is set to `'1'`.

#### Scenario: Dev bypass enabled
- **WHEN** `import.meta.env.VITE_DEV_BYPASS_LICENSE === '1'`
- **THEN** `LicenseGate` renders children immediately without checking license status

## Implementation References

- `src-tauri/src/license.rs` — Machine fingerprint, checkout provider API, cache persistence, Tauri command implementations
- `src/lib/license.ts` — Frontend bridge (`activateLicense`, `checkLicense`, `deactivateLicense`)
- `src/components/app/LicenseGate.tsx` — Gate component, activation UI, context provider
- `src/App.tsx` — Imports `LicenseGate` and `useLicenseGate`, wraps app

## Test Coverage

- `src-tauri/src/license.rs` — 6 Rust tests: serialization (camelCase), inactive constructors, cache roundtrip, fingerprint determinism
- `src/components/app/LicenseGate.test.tsx` — Gate component tests
