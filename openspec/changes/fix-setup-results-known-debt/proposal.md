## Why

The review of PR #236 (released in gui 3.12.0) listed three gaps in the setup results and preview screens. These gaps were already on main before that PR:

- In the light theme the status text on result, preview and restore rows was below WCAG AA. On white, FAILED red was 4.20:1, MANUAL and CANCELLED amber 2.63:1, and INSTALLED green 2.89:1. TO INSTALL blue was 3.68:1, INSTALLING blue 2.54:1 and DETECTED teal 3.74:1.
- The preview "N apps" chip counted only apps to install and apps already present. Its click clears the filters and shows a skipped manual app too, so the chip did not equal its rows.
- A failed app with no engine message got the fallback "Install failed (no details provided)", even in a preview or dry run, which installs nothing.

## What Changes

- Add text-only status colour tokens (`--status-success`, `--status-warning`, `--status-danger`, `--status-info`, `--status-action`, `--status-detected`) and use them in `getColorClasses`. The dark theme keeps the colours these rows already had. Teal moves to the 400 shade the rows already asked for, because no `.dark` class enables Tailwind's `dark:` variant. The light theme uses darker shades that reach at least 4.99:1 on white, on the panel, on the muted surface and on a chip's 10% tint. The shared semantic tokens (`--success`, `--warning`, `--danger`) are unchanged, because solid badges and buttons pair them with their own foreground colours.
- The preview "N apps" chip counts the app rows that its click shows: every displayed app row that is not a settings-only row, including manual and skipped apps. With the per-app picker on, it counts the selected rows, like the chips beside it.
- The no-message fallback for a failed app uses the phase-aware wording from #236: "Couldn't check this app (no details provided)" in a preview or dry run (the plan phase), and "Couldn't install this app (no details provided)" in a real run.

## Capabilities

### Modified Capabilities

- `setup-list-presentation`: adds status-text contrast, the preview app-chip count and the phase-aware no-message fallback.

## Impact

- GUI only: `src/styles/globals.css`, `tailwind.config.js`, `src/lib/apply-utils.ts`, `src/components/app/intent/setup-flow.tsx`, `docs/ux-language.md`.
- No engine change, and no change to `--success`, `--warning` or `--danger`.
- Archive order: the `setup-list-presentation` capability exists only in the unarchived change `present-windows-settings`. Archive that change first, so this change's requirements have a target spec.
