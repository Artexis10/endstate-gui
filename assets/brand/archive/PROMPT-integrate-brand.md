# Task: Integrate Endstate brand assets into the GUI

## Context

Brand SVGs are in `assets/brand/`. See `assets/brand/BRAND.md` for the full reference.

Key files:
- `mark-light.svg` — geometric "E" mark, light (#e6edf3) on transparent
- `mark-dark.svg` — geometric "E" mark, dark (#101820) on transparent
- `wordmark-light.svg` — "endstate" text, light on transparent
- `wordmark-dark.svg` — "endstate" text, dark on transparent
- `favicon.svg` — light mark on transparent (for browser tab)

Brand colors:
- Ink (dark bg): `#101820`
- Light foreground: `#e6edf3`
- Muted: `#8b949e`

## What to do

### 1. Sidebar header — replace text with mark + wordmark

Current code in `src/components/layout/app-shell.tsx` (~line 75):

```tsx
<div className="p-6 border-b border-border min-w-[256px]">
  <h1 className="text-xl font-semibold text-primary">Endstate</h1>
  <p className="text-xs text-muted-foreground mt-1">Setup Management</p>
</div>
```

Replace with the mark SVG inline (or as an imported component) alongside "endstate" text or the wordmark SVG. The mark should sit to the left of the text at ~20-24px. Keep "Setup Management" subtitle or remove if it looks cleaner without.

Use `mark-light.svg` since the sidebar uses a dark panel background (`bg-panel`). If the app supports light mode, conditionally use `mark-dark.svg`.

### 2. Landing page — add mark to the hero/welcome area

Check the landing page component for where the product name appears. Add the mark there too — centered, slightly larger (~32-40px).

### 3. Favicon

Replace the current favicon in `index.html` (or Tauri config) with `assets/brand/favicon.svg`.

## Constraints

- Import SVGs as React components (Vite supports this via `?react` suffix or use inline SVG)
- Do not rasterize — keep SVGs for crispness at all sizes
- Match existing spacing/padding conventions in the shell
- The mark is a circle with internal geometry — it looks best at 20px+ sizes
- Do not modify the SVG source files

## Read first

- `assets/brand/BRAND.md` — full asset catalog and usage guide
- `src/components/layout/app-shell.tsx` — current sidebar/shell layout
- `src/App.tsx` — landing page routing
