# Endstate Hosted Backup Contract

This document links to the canonical hosted-backup contract maintained in the Endstate engine repository.

## Canonical Source

**See:** [Endstate Engine — Hosted Backup Contract](https://github.com/Artexis10/endstate/blob/main/docs/contracts/hosted-backup-contract.md)

For local development, the contract is located at:
```
../endstate/docs/contracts/hosted-backup-contract.md
```

## Summary

The hosted-backup contract defines the v2 paid tier where users upload encrypted profile backups to Endstate-operated infrastructure and restore them on another supported Windows PC.

Key elements relevant to the GUI:

1. **Trust model** — Endstate cannot decrypt user data. Structural property, not policy. The GUI never sees user passphrases or raw key material.

2. **Engine boundary** — All cryptographic operations (Argon2id KDF, AES-256-GCM, JWT validation, R2 upload/download) happen in the Go engine, not the GUI. The GUI calls engine commands and renders status. Per the thin-GUI invariant in `PROJECT_SHADOW.md`, this is enforced.

3. **GUI responsibility** — The GUI implements the user-facing surfaces required by the contract:
   - Sign-in / sign-up forms
   - Recovery key generation, presentation, and verification (mandatory at signup)
   - At least two save formats for the recovery key (file + printable PDF)
   - Backup pane with status, version list, and restore action
   - Restore-on-new-machine wizard
   - Account deletion confirmation

4. **No direct backend access** — The GUI does not talk to the substrate backend directly. All backend calls go through the engine (`endstate backup *` commands).

5. **Version compatibility** — The GUI checks `engineVersion >= 2.0.0` before exposing any hosted-backup UI. Existing capabilities-handshake pattern.

## Engine commands the GUI consumes

To be confirmed once the engine prompt is implemented. Expected surface:
- `endstate backup login --email <email>` — signup or login
- `endstate backup logout` — clear stored refresh token
- `endstate backup status` — current account state, subscription, last backup
- `endstate backup push <profile>` — upload a backup
- `endstate backup pull <profile> [--version <id>]` — download and restore
- `endstate backup list` — list backups + versions
- `endstate backup delete <backupId>` — delete a backup
- `endstate backup recover --email <email>` — recovery key flow
- `endstate account delete` — GDPR account deletion

The GUI invokes these via the existing `engine_run` Tauri command pattern and renders streaming events as it does today.
