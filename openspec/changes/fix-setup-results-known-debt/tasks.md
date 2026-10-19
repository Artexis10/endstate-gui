## 1. Status text contrast

- [x] 1.1 Add `--status-*` text tokens to `globals.css` (dark keeps the existing colours; light reaches at least 4.5:1) and map them in `tailwind.config.js`.
- [x] 1.2 Point the `text` classes in `getColorClasses` at the new tokens.
- [x] 1.3 Unit (`src/lib/status-contrast.test.ts`): read the tokens from `globals.css` and check AA in light and no loss in dark.

## 2. Preview "N apps" chip

- [x] 2.1 Count the preview's app rows that the cleared list shows (the selected rows with the picker on).
- [x] 2.2 Component (`setup-flow-app-picker.test.tsx`): a preview with a skipped manual app reads "3 apps" and its click shows 3 rows, with and without the picker.

## 3. Phase-aware no-message fallback

- [x] 3.1 Build the fallback from the phase-aware failure text in `itemEventToAppEvent`.
- [x] 3.2 Unit (`apply-utils-streaming.test.ts`): a plan-phase failure with no message never says "install"; an apply-phase one says "Couldn't install this app".

## 4. Docs

- [x] 4.1 Update `docs/ux-language.md` "Setup preview and results lists" and the apply colour note.
