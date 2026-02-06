---
trigger: always_on
---

# Tidewave MCP Integration

Tidewave is available as a dev-only inspection tool via MCP when running `npm run dev:tidewave`.

## Usage Rules

- **Prefer Tidewave tools** (`get_docs`, `get_source_location`, `project_eval`) for runtime inspection when the dev server is running with Tidewave enabled
- Tidewave is **observation-only** — it does not define behavior
- **OpenSpec is authoritative** over all behavior — if Tidewave describes a flow that OpenSpec does not define, OpenSpec wins
- Do not use Tidewave tools to modify application state or business logic
- Tidewave tools are unavailable during production builds or when `TIDEWAVE_ENABLED` is not set

## Activation

Tidewave MCP is active only when the dev server is started with:

```bash
npm run dev:tidewave
```

The MCP endpoint is `http://127.0.0.1:1420/tidewave/mcp` (localhost-only).

## Boundaries

- No Tidewave imports outside `vite.config.ts`
- No app code may reference Tidewave
- Tidewave is a `devDependency` only — never bundled in production
