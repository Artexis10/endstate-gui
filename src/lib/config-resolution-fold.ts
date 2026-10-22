import type { ConfigResolutionKind, ConfigResolutionStatus } from '@/types';
import { settingsModulesPhrase } from './settings-kind';

/**
 * What a config resolution asks of the person. The final list and the live
 * apply list both decide from this one function, so they cannot disagree.
 */
export type Disposition = 'attention' | 'direct' | 'folded';

/**
 * The fields the rule reads. A `config-resolution` stream event carries no
 * `status`: the engine emits it before it changes the set. Some failures reach
 * the GUI only as a `reason` on that event, with no later event, so the rule
 * reads the reason for every kind, with or without a status.
 */
export interface FoldInput {
  resolution: ConfigResolutionKind;
  reason: string | null;
  status?: ConfigResolutionStatus;
}

// Terminal statuses that mean a config set did not end well.
const FAILED_STATUSES: ReadonlySet<ConfigResolutionStatus> = new Set([
  'failed',
  'rolled_back',
  'rollback_failed',
]);

// The engine's documented reasons (Endstate engine repo,
// docs/contracts/cli-json-contract.md) that need nothing from the person: no
// target app yet, nothing to change, or not selected. The documented list is
// open ("include"), so every other reason, including a new one, needs the
// person.
const REASONS_NEEDING_NOTHING: ReadonlySet<string> = new Set([
  'target_not_detected',
  'already_up_to_date',
  'restore_filtered',
  'restore_not_enabled',
]);

export function disposition(resolution: FoldInput): Disposition {
  if (resolution.status !== undefined && FAILED_STATUSES.has(resolution.status)) return 'attention';
  if (resolution.reason !== null && !REASONS_NEEDING_NOTHING.has(resolution.reason)) {
    return 'attention';
  }
  switch (resolution.resolution) {
    case 'direct':
      return 'direct';
    case 'legacy_unverified':
      return 'folded';
    case 'unknown':
      // With no reason, nothing says why the engine could not decide.
      return resolution.reason === null ? 'attention' : 'folded';
    default:
      // migrate and incompatible always matter to the person.
      return 'attention';
  }
}

/**
 * The GUI-authored line over the folded resolutions. Counts come from the
 * data, over distinct modules. The reason sentence only claims what holds:
 * the legacy kind is the only one that was saved before version checks.
 */
export function foldedLine(
  resolutions: ReadonlyArray<{ moduleId: string; resolution: ConfigResolutionKind }>,
): string {
  const moduleIds = (rows: typeof resolutions) => [...new Set(rows.map((r) => r.moduleId))];
  const all = moduleIds(resolutions);
  const legacy = moduleIds(resolutions.filter((r) => r.resolution === 'legacy_unverified'));
  const lead = `Compatibility not checked for ${settingsModulesPhrase(all)}.`;

  if (legacy.length === 0) return lead;
  const reason = 'saved before Endstate checked versions';
  if (legacy.length === all.length) {
    return `${lead} ${all.length === 1 ? 'It was' : 'They were'} ${reason}.`;
  }
  return `${lead} ${legacy.length} of them ${legacy.length === 1 ? 'was' : 'were'} ${reason}.`;
}
