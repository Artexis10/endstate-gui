# License Gate

## Purpose

Gate the GUI behind license key activation. The GUI requires a valid Ed25519-signed license key tied to a machine fingerprint. Unlicensed users see an activation screen; licensed users proceed to the app. Offline use is supported via a cryptographically verified cache, with periodic online re-validation. Development builds can bypass the gate entirely.

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
The system SHALL activate a license key by calling `POST https://substratesystems.io/api/license/activate` with a JSON body `{ key, fingerprint, machine_name }`, verify the Ed25519 signature on the response using the embedded public key, and persist a signed cache on success.

#### Scenario: Successful activation
- **WHEN** the server returns `{ activated: true, instance_id, activated_at, expires_at, signature }` and the signature verifies against `sha256(key || fingerprint || activated_at || expires_at)` using the embedded Ed25519 public key
- **THEN** the system persists a cache file containing `key`, `instanceId`, `fingerprint`, `activatedAt`, `expiresAt`, `signature`, and `lastValidatedAt` (set to now)
- **AND** returns `LicenseStatus` with `activated: true`

#### Scenario: Signature verification failure on activation
- **WHEN** the server returns `activated: true` but the signature does not verify against the embedded public key
- **THEN** no cache is written
- **AND** returns `LicenseStatus` with `activated: false` and `validationError: "License response failed signature verification"`

#### Scenario: Failed activation
- **WHEN** the server returns `{ activated: false, error, message }` or an HTTP error
- **THEN** no cache is written
- **AND** returns `LicenseStatus` with `activated: false` and the server's `message` in `validationError`

#### Scenario: Device limit reached
- **WHEN** the server returns `{ activated: false, error: "device_limit_reached", message }`
- **THEN** the server's `message` is surfaced verbatim in `validationError`
- **AND** no cache is written

### Requirement: License cache persists to disk
The system SHALL store license data at `%APPDATA%/com.substratesystems.endstate/license.json` using camelCase JSON fields: `key`, `instanceId`, `fingerprint`, `activatedAt`, `expiresAt`, `signature`, `lastValidatedAt`.

#### Scenario: Cache written on activation
- **WHEN** activation succeeds and the response signature verifies
- **THEN** the cache file is created (with parent directory) containing all seven fields

#### Scenario: Cache deleted on deactivation
- **WHEN** deactivation succeeds
- **THEN** the cache file is removed from disk

#### Scenario: Cache deleted on remote invalidation
- **WHEN** online validation returns `valid: false`
- **THEN** the cache file is removed from disk

#### Scenario: Cache deleted on signature failure
- **WHEN** a cache file is read whose signature does not verify against `sha256(key || fingerprint || activatedAt || expiresAt)` using the embedded public key
- **THEN** the cache file is removed from disk
- **AND** the user is treated as unlicensed

### Requirement: License check validates signature, fingerprint, and re-validates periodically
The system SHALL check license status by reading the cache, verifying the Ed25519 signature, verifying the fingerprint matches the current machine, and re-validating online when the cache is older than 30 days since `lastValidatedAt`.

#### Scenario: No cache exists
- **WHEN** no cache file exists at the expected path
- **THEN** returns `LicenseStatus` with `activated: false` (no error)

#### Scenario: Signature mismatch
- **WHEN** the cache exists but its signature does not verify against the embedded public key
- **THEN** the cache file is deleted
- **AND** returns `LicenseStatus` with `activated: false` and `validationError: "License cache failed signature verification"`

#### Scenario: Fingerprint mismatch
- **WHEN** cache exists and signature verifies but the stored fingerprint does not match the current machine's fingerprint
- **THEN** returns `LicenseStatus` with `activated: false` and `validationError: "License was activated on a different machine"`

#### Scenario: Offline within re-validation window
- **WHEN** cache exists, signature verifies, fingerprint matches, `lastValidatedAt` is less than 30 days ago, and the API is unreachable
- **THEN** trusts the cache and returns `LicenseStatus` with `activated: true`

#### Scenario: Online re-validation succeeds
- **WHEN** cache exists, signature verifies, fingerprint matches, and the server returns `{ valid: true, activated_at, expires_at, signature }` whose signature verifies against the embedded public key
- **THEN** the cache is updated with the new `activatedAt`, `expiresAt`, `signature`, and `lastValidatedAt` set to now
- **AND** returns `LicenseStatus` with `activated: true`

#### Scenario: Online re-validation fails
- **WHEN** cache exists, signature verifies, fingerprint matches, and the server returns `{ valid: false, error, message }`
- **THEN** deletes the cache file
- **AND** returns `LicenseStatus` with `activated: false` and the server's `message` in `validationError`

#### Scenario: Offline past re-validation window
- **WHEN** cache exists, signature verifies, fingerprint matches, `lastValidatedAt` is 30 days or more in the past, and the API is unreachable
- **THEN** returns `LicenseStatus` with `activated: false` and `validationError: "License must be re-validated online"`
- **AND** the cache file is NOT deleted

### Requirement: Deactivation calls checkout provider API
The system SHALL deactivate by calling `POST https://substratesystems.io/api/license/deactivate` with a JSON body `{ key, instance_id }` using values from the cache.

#### Scenario: Successful deactivation
- **WHEN** the server returns `{ deactivated: true }`
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
- **THEN** an activation card is displayed with a key input field, activate button, and "Buy Endstate" link pointing to the Paddle checkout URL for Endstate

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

- `src-tauri/src/license.rs` — Machine fingerprint, Ed25519 signature verification, substratesystems.io API client, cache persistence, Tauri command implementations
- `src-tauri/src/license_pubkey.rs` — Embedded 32-byte Ed25519 public key (root of trust; protected)
- `src/lib/license.ts` — Frontend bridge (`activateLicense`, `checkLicense`, `deactivateLicense`)
- `src/components/app/LicenseGate.tsx` — Gate component, activation UI, context provider
- `src/App.tsx` — Imports `LicenseGate` and `useLicenseGate`, wraps app

## Test Coverage

- `src-tauri/src/license.rs` — 25 Rust tests: serialization (camelCase), inactive constructors, cache roundtrip, legacy-cache rejection, canonical hash stability, signature verification (valid / tampered payload / tampered signature / wrong key / bad base64 / wrong length), window state (fresh / stale / boundary / unparseable), decide_check (offline within window / offline past window / server valid:false / server valid:true / re-validation signature failures), fingerprint determinism
- `src/components/app/LicenseGate.test.tsx` — Gate component tests
