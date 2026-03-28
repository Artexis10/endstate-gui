## Context

The license gate has a dev bypass controlled by `VITE_DEV_BYPASS_LICENSE`. Vite injects env vars at build time from both `.env` files and the process environment. A `.env.production` file was added as a workaround, but this relies on Vite precedence rules.

## Goals / Non-Goals

**Goals:**
- Production builds can never bypass the license gate, regardless of build environment
- Dev workflow (`npm run dev` / `npm run tauri dev`) is unchanged

**Non-Goals:**
- Changing the license validation logic itself
- Adding runtime license checks

## Decisions

### Decision 1: Use `import.meta.env.DEV` as a hard gate

Vite's `import.meta.env.DEV` is `true` during `vite dev` and `false` during `vite build`. It is not controllable by environment variables — it is derived from the Vite command itself. By requiring both `DEV === true` AND the bypass flag, production builds structurally cannot bypass licensing.

**Alternative considered**: `.env.production` override. Rejected because it relies on Vite's file-over-env precedence, which is fragile.

### Decision 2: Delete `.env.production`

The `DEV` guard makes the env-var-level override redundant. Removing it avoids maintaining a defense-in-depth layer that adds confusion without value.
