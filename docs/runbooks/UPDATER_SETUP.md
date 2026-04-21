# Tauri Auto-Updater Setup

This runbook covers the one-time setup of signing keys for the Endstate GUI auto-updater. Key generation is interactive, so it cannot be scripted — a human must run the commands and handle the secrets.

## Overview

The Tauri v2 updater verifies every downloaded bundle against an ed25519 signature. We keep:

- **Public key** — committed in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. Safe to commit.
- **Private key** — used by CI to sign release artifacts. **Never commit.** Stored in a password manager and as a GitHub Actions secret.

The GUI repo ships with the real public key committed under `plugins.updater.pubkey`. A placeholder (`REPLACE_WITH_ACTUAL_PUBLIC_KEY`) was used during initial wiring; see Step 3 below for the format if you ever need to regenerate.

## Prerequisites

- Node 20+
- `@tauri-apps/cli` 2.x (already in `devDependencies`)
- Access to the `endstate-gui` GitHub repo settings (Actions secrets)
- A password manager / secrets vault for storing the private key

## Step 1 — Generate the keypair

Run this on a trusted workstation. The command is interactive; it will prompt for a password that encrypts the private key on disk.

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/endstate-updater.key
```

On Windows (bash / Git Bash):

```bash
npx @tauri-apps/cli signer generate -w "$HOME/.tauri/endstate-updater.key"
```

This writes two files:

- `~/.tauri/endstate-updater.key` — the **private** key (encrypted with your password)
- `~/.tauri/endstate-updater.key.pub` — the **public** key

The terminal also prints the same public key. Copy it — you'll paste it into `tauri.conf.json` in Step 3.

## Step 2 — Store the private key securely

1. Save the contents of `~/.tauri/endstate-updater.key` in the team password manager.
2. Save the password you chose in Step 1 alongside it.
3. Do **not** commit the key file. Do **not** email or paste it into chat. `~/.tauri/` should be outside any synced folder.

Once stored, add both as GitHub Actions secrets on the `endstate-gui` repo. The secret names match the Tauri CLI's expected env vars exactly, so the release workflow can reference them 1:1 without translation:

1. Go to **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `TAURI_SIGNING_PRIVATE_KEY`. Value: the full contents of `endstate-updater.key` (including `untrusted comment:` header).
3. Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Value: the password from Step 1.

The release workflow will consume these as `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars during `tauri build`.

## Step 3 — Update `tauri.conf.json`

Paste the public key from Step 1 into `src-tauri/tauri.conf.json` as a single line:

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": [
      "https://substratesystems.io/updates/latest.json"
    ],
    "dialog": false,
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkgM0E1Qjc4...=="
  }
}
```

The `pubkey` value is the base64 of the entire `.pub` file (two lines: the `untrusted comment:` header plus the key itself). Tauri expects this exact format.

Commit the change. The public key is safe to share publicly — it only lets clients verify signatures, not create them.

## Step 4 — Verify

After the first signed release:

1. Install the published build on a test machine.
2. Publish a bumped release (e.g., 1.7.0 → 1.7.1) through the release workflow.
3. Open the test-machine build. An "Endstate 1.7.1 is available" toast should appear within a second or two.
4. Click **Install and restart**. Confirm the app relaunches on the new version.

If verification fails silently, check the app's log / devtools console — signature failures are logged but do not surface a user-facing error.

## Rotating the key

If the private key is compromised:

1. Generate a fresh keypair (Step 1) to a new filename.
2. Update both GitHub Actions secrets (Step 2).
3. Update `pubkey` in `tauri.conf.json` (Step 3) and ship a new release signed with the new key.
4. **Clients running builds signed with the old key will stop receiving updates** — they must be reinstalled manually. There is no in-app migration path. Plan a comms window before rotating.

## Related

- Release workflow integration: *(upcoming change — Prompt 2)*
- Manifest hosting: *(upcoming change — Prompt 3)*
- Tauri updater docs: https://v2.tauri.app/plugin/updater/
