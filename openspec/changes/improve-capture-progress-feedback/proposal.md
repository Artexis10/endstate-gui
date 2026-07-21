## Why

Capture currently presents an indeterminate spinner with no meaningful updates for long stretches; a real Windows run took 22.5 seconds and emitted no app item for the first 14.7 seconds. The same run also rendered detected apps as **Excluded** because an older engine status fell through the GUI's unknown-status fallback. Capture additionally omits Microsoft Store packages even though the CLI exposes an apparent Store-inclusion flag, leaving profiles silently incomplete.

## What Changes

- Consume additive engine capture progress events and translate their stage keys into user-facing GUI copy.
- Show capture progress immediately, including the active stage, elapsed time, an indeterminate progress treatment, and a delayed reassurance when capture is taking longer than expected.
- Keep the progress treatment useful with older engines that do not emit stage events.
- Treat the legacy capture item status `captured` as detected for backward compatibility, without turning other unknown statuses into policy exclusions.
- Display captured Microsoft Store packages and non-fatal Store-source warnings from the engine without introducing a GUI-only source-selection rule or toggle.
- Keep final success, counts, and artifacts authoritative from the engine's stdout envelope.

## Capabilities

### New Capabilities

- `capture-progress-feedback`: Defines truthful, accessible capture-stage feedback, slow-operation reassurance, and legacy status compatibility in the Save flow.
- `store-package-visibility`: Defines how captured Store packages and Store-source warnings appear in the Save flow and capture details.

### Modified Capabilities

- `gui-thin-layer`: Requires capture stages to come from engine events while keeping user-facing wording and elapsed-time presentation in the GUI.

## Impact

- `src/lib/streaming-events.ts` gains the additive progress event type and parser support.
- `src/App.tsx` passes engine-owned stage state into the existing Save flow without deriving engine work.
- `src/components/app/intent/save-flow.tsx` and a focused progress component render the live stage, elapsed time, and delayed reassurance.
- `src/lib/apply-utils.ts` gains capture-specific compatibility for legacy `captured` item events and a safe unknown-status path.
- Capture result presentation preserves engine-reported `msstore` source identity and surfaces non-fatal source warnings.
- GUI tests and `docs/ux-language.md` cover the new feedback, compatibility, and Store-source behavior.
- Requires the matching `improve-capture-progress-feedback` engine change for full stage fidelity and Store support; remains functional with older engines without fabricating Store coverage.
