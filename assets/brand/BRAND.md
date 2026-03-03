# Endstate Brand Assets

## Colors

- **Ink (primary background):** `#101820`
- **Light mark:** `#e6edf3`
- **Dark mark:** `#101820`
- **Muted mark:** `#8b949e`

## Asset Reference

| File | Use Case |
|------|----------|
| `mark-light.svg` | Standalone mark for dark backgrounds (transparent bg) |
| `mark-dark.svg` | Standalone mark for light backgrounds (transparent bg) |
| `mark-muted.svg` | Subtle/watermark variant (transparent bg) |
| `app-icon.svg` | Primary app icon — ink bg, light mark, rounded rect |
| `app-icon-closed.svg` | Closed-path variant for small sizes (favicons, taskbar) |
| `favicon.svg` | Browser favicon — transparent bg, light mark |
| `mark-on-dark.svg` | Mark on ink background (square) |
| `mark-on-dark-round.svg` | Mark on ink background (rounded) |
| `og-mark.svg` | Open Graph / social preview (1200×630, ink bg) |
| `wordmark-light.svg` | "endstate" wordmark for dark backgrounds |
| `wordmark-dark.svg` | "endstate" wordmark for light backgrounds |

## Design System

- The mark is a geometric "E" constructed from three horizontal bars
- Proportions: 24×24 viewBox, 3px stroke weight, 2px bar gap
- No gradients, no shadows — flat, monochrome
- Ink (#101820) is the canonical background for all bounded variants
- Standalone marks always use transparent backgrounds

## Usage Guidelines

- **Sidebar/titlebar on dark UI:** `mark-light.svg` or `wordmark-light.svg`
- **Sidebar/titlebar on light UI:** `mark-dark.svg` or `wordmark-dark.svg`
- **Tauri window icon:** `app-icon.svg` (or `app-icon-closed.svg` at small sizes)
- **Web favicon:** `favicon.svg`
- **Social/OG tags:** `og-mark.svg`
- **Subtle branding:** `mark-muted.svg`
