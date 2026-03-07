# Endstate Brand Assets

## Colors

- **Ink (primary background):** `#101820`
- **Light mark:** `#e6edf3`
- **Dark mark (for light bg):** `#1f2937`
- **Muted mark:** `#8b949e`

## Mark

The mark is a spiral — an open arc with a filled disc and dark pupil.
Canonical geometry: 100×100 viewBox, `translate(-48,-48)` origin.

## Icon Kit (`icons/`)

```
icons/
├── transparent/         # General brand — canonical (scale 1.15)
│   ├── transparent-sw4.svg / .png    # General use (web, print, large contexts)
│   └── transparent-sw5.svg / .png    # Bold variant
├── dark-full/           # Dark bg (#101820), full bleed (scale 1.15)
│   ├── dark-sw4.svg / .png           # Installer source, favicon
│   └── dark-sw5.svg / .png           # Bold on dark variant
├── dark-padded/         # Dark bg, padded (scale 0.95) — survives circular crops
│   ├── dark-padded-sw4.svg / .png    # Store listings, social avatars
│   └── dark-padded-sw5.svg / .png    # Bold padded variant
└── taskbar/             # OS taskbar/title bar optimized (scale 1.20)
    ├── taskbar-sw4.svg / .png        # Taskbar general
    └── taskbar-sw5.svg / .png        # Taskbar bold — Tauri icon source
```

### Scale Tiers

| Tier | Scale | Translate | Purpose |
|------|-------|-----------|---------|
| General | 1.15 | (52, 60) | Brand mark — transparent and dark-full |
| Padded | 0.95 | (51, 57) | Circular crops, store listings — dark-padded |
| Taskbar | 1.20 | (52, 62) | OS taskbar/title bar — maximum legibility at small sizes |

### Stroke Weights

| Weight | Use |
|--------|-----|
| sw4 | General use (web, print, large contexts) |
| sw5 | Small contexts (taskbar, sidebar, title bar) |

### When to Use What

| Context | Variant |
|---------|---------|
| General brand / marketing / web | `transparent/transparent-sw4` |
| App sidebar / in-app mark | `transparent/transparent-sw5` (via `mark-sidebar.svg`) |
| Landing page nav (on dark bg) | `transparent/transparent-sw5` |
| Tauri window/taskbar icons | `taskbar/taskbar-sw5` (via `icon-source-1024.png`) |
| Installer / uninstaller | `dark-padded/dark-padded-sw4` (via `installer.ico`) |
| Favicon | `dark-full/dark-sw4` |
| Store listings / avatars | `dark-padded/dark-padded-sw4` |
| Social profiles / circular crops | `dark-padded/dark-padded-sw5` |

## Canonical Aliases (root level)

These files are referenced in code and map to specific icon kit variants:

| File | Maps to | Used in |
|------|---------|---------|
| `icon-source.svg` | `icons/dark-full/dark-sw4.svg` | Favicon source |
| `icon-source-1024.png` | `icons/taskbar/taskbar-sw5-1024.png` | `npm run tauri icon` input |
| `mark-sidebar.svg` | `icons/transparent/transparent-sw5.svg` | `app-shell.tsx` sidebar |

## Other Assets

| File | Purpose |
|------|---------|
| `wordmark-light.svg` | "Endstate" text + mark, light on dark |
| `wordmark-dark.svg` | "Endstate" text + mark, dark on light |

## Archive

`archive/` contains iteration artifacts and superseded variants.
Do not reference these in code.

## Regenerating Tauri Icons

```bash
# Source: taskbar-sw5-1024.png (scale 1.20, transparent, bold stroke)
npm run tauri icon assets/brand/icon-source-1024.png
```

## Variant Creation

To create a new variant from any canonical SVG:
- **Remove background:** Delete the `<rect>` element
- **Change stroke weight:** Edit `stroke-width="4"` → `"5"` (or vice versa)
- **Change scale tier:** Edit scale value and adjust translate accordingly
- **Change background color:** Edit `fill="#101820"` on the `<rect>`
