/**
 * Capability gating for the per-app setup picker.
 *
 * The picker ships dark and only activates when the engine advertises
 * `apply --only` (app-subset selection; engine OpenSpec change
 * `apply-app-subset`). The predicate defaults to the safe/off answer when
 * inputs are missing, so against older engines the preview renders exactly
 * as before.
 */

import type { EndstateCapabilitiesData } from '../types';

/**
 * Whether the engine advertises `apply --only` (per-app subset selection).
 *
 * Defaults to FALSE when unknown. Detection follows the same defensive shape
 * probing as `engineSupportsIfChanged`: the GUI's `commands` type is loose
 * (string[]); the real engine emits a map of `commands.<cmd>.flags`, so only
 * the map shape is trusted.
 */
export function engineSupportsApplyOnly(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  return engineSupportsApplyFlag(caps, '--only');
}

/** Whether the engine accepts explicit per-capture restore targets on apply. */
export function engineSupportsApplyRestoreTarget(
  caps: EndstateCapabilitiesData | null | undefined,
): boolean {
  return engineSupportsApplyFlag(caps, '--restore-target');
}

function engineSupportsApplyFlag(
  caps: EndstateCapabilitiesData | null | undefined,
  flag: string,
): boolean {
  if (!caps) return false;

  const commands = (caps as { commands?: unknown }).commands;
  if (commands && typeof commands === 'object' && !Array.isArray(commands)) {
    const apply = (commands as Record<string, { flags?: unknown }>).apply;
    if (Array.isArray(apply?.flags) && apply.flags.includes(flag)) {
      return true;
    }
  }

  return false;
}
