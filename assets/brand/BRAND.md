# Endstate Brand Assets

## Colors

- **Ink (primary background):** `#101820`
- **Light mark:** `#e6edf3`
- **Dark mark (for light bg):** `#1f2937`
- **Muted mark:** `#8b949e`

## Mark

The mark is a spiral — an open arc with a filled disc and dark pupil.
Proportions: 96×96 viewBox, 3px stroke weight (default), round linecap.

## Active Assets (referenced in code)

| File | Used In | Purpose |
|------|---------|---------|
| `mark-sidebar.svg` | `app-shell.tsx` | Sidebar logo mark |
| `icon-source-1024.png` | `npm run tauri icon` | Source PNG for window/taskbar icon generation |
| `icon-source.svg` | — | SVG source for the above PNG |
| `favicon.svg` | `public/favicon.svg` | Browser tab favicon |

## Reference Assets (marketing, social, external use)

| File | Purpose |
|------|---------|
| `mark-light.svg` | Standalone mark, light on transparent |
| `mark-dark.svg` | Standalone mark, dark on transparent |
| `mark-muted.svg` | Standalone mark, muted gray |
| `mark-on-dark.svg` | Mark on ink square background |
| `mark-on-dark-round.svg` | Mark on ink circle background |
| `app-icon.svg` | Mark on ink rounded rect (app store style) |
| `og-mark.svg` | Open Graph / social preview (120×120) |
| `wordmark-light.svg` | "Endstate" text + mark, light |
| `wordmark-dark.svg` | "Endstate" text + mark, dark |

## Archive

`archive/` contains iteration artifacts and superseded variants.
Do not reference these in code.

## Usage

- **App sidebar:** `mark-sidebar.svg` (imported via Vite `?url`)
- **Tauri window icons:** Regenerate with `npm run tauri icon assets/brand/icon-source-1024.png`
- **Web favicon:** `favicon.svg` (copy in `public/`)
- **Landing page / marketing:** `mark-light.svg` or `wordmark-light.svg`
- **Social/OG tags:** `og-mark.svg`
