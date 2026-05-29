## Why

`LicenseGate.tsx` bypasses license checks when `VITE_DEV_BYPASS_LICENSE=1`. This is a build-time env var that Vite reads from both `.env` files and the shell environment. If the build machine has the var set (e.g., from a shell profile), it gets baked into the production binary, silently disabling the license gate for all users.

The `.env.production` workaround (setting the var to `0`) is fragile — it relies on Vite's file-over-env precedence, which is an implementation detail.

## What Changes

- **Harden the bypass check**: Require `import.meta.env.DEV` (Vite built-in, `true` only in dev mode) AND the explicit bypass flag. Production builds always have `DEV === false`, making bypass impossible regardless of env contamination.
- **Delete `.env.production`**: No longer needed — the `DEV` guard makes env-var-level protection redundant.

## Capabilities

### Modified Capabilities

- `license-gate`: Dev bypass now requires Vite dev mode in addition to the flag. Production builds can never bypass.

## Impact

- **Frontend**: `src/components/app/LicenseGate.tsx` (one line change)
- **Build**: `.env.production` deleted
- **No backend changes**
