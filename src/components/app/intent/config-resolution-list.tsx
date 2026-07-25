import type {
  ConfigResolution,
  ConfigResolutionKind,
  RestoreTargetMapping,
} from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';

interface ConfigResolutionListProps {
  resolutions: ConfigResolution[];
  moduleDisplayNames?: Readonly<Record<string, string>>;
  restoreTargetSupported?: boolean;
  targetMappings?: RestoreTargetMapping[];
  onTargetMappingChange?: (mapping: RestoreTargetMapping) => void;
}

/** One card per composite `(resolution, label, message)` group. */
interface ResolutionGroup {
  kind: 'group';
  key: string;
  resolution: ConfigResolutionKind;
  label: string;
  message: string;
  members: ConfigResolution[];
}

/** A decision-bearing row (side-by-side target ambiguity) rendered on its own. */
interface IndividualResolution {
  kind: 'individual';
  resolution: ConfigResolution;
}

type RenderItem = ResolutionGroup | IndividualResolution;

export function ConfigResolutionList(
  {
    resolutions,
    moduleDisplayNames = {},
    restoreTargetSupported = false,
    targetMappings = [],
    onTargetMappingChange,
  }: ConfigResolutionListProps,
) {
  if (resolutions.length === 0) return null;

  const items = buildRenderItems(resolutions);

  return (
    <section className="space-y-2" aria-label="Settings compatibility">
      {items.map((item) => {
        if (item.kind === 'individual') {
          const resolution = item.resolution;
          return (
            <article
              key={resolution.captureId}
              className="rounded-lg border border-border bg-muted/20 p-3"
              data-testid={`config-resolution-${resolution.captureId}`}
              data-resolution={resolution.resolution}
              data-status={resolution.status}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {moduleDisplayNames[resolution.moduleId] && (
                    <p className="text-xs font-medium text-foreground">
                      {moduleDisplayNames[resolution.moduleId]}
                    </p>
                  )}
                  <p className="text-sm font-medium">{resolution.label}</p>
                  <p className="text-xs text-muted-foreground">{resolution.message}</p>
                  {resolution.remediation !== null && (
                    <p className="text-xs text-muted-foreground">{resolution.remediation}</p>
                  )}
                </div>
                <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                  {resolution.status}
                </span>
              </div>
              {restoreTargetSupported
                && resolution.reason === 'ambiguous_target_instance'
                && onTargetMappingChange && (
                  <div className="mt-3">
                    <Select
                      value={targetMappings.find(
                        (mapping) => mapping.captureId === resolution.captureId,
                      )?.targetInstanceId}
                      onValueChange={(targetInstanceId) => onTargetMappingChange({
                        captureId: resolution.captureId,
                        targetInstanceId,
                      })}
                    >
                      <SelectTrigger
                        className="h-8"
                        aria-label={`Target for ${resolution.captureId}`}
                      >
                        <SelectValue placeholder="Choose a target" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolution.targetCandidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.rawVersion
                              ? `${candidate.id} · ${candidate.rawVersion}`
                              : candidate.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              <DetailsDisclosure title="Configuration details" className="mt-3">
                <dl className="space-y-1 text-xs text-muted-foreground">
                  {provenanceEntries(resolution).map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                      <dt>{label}</dt>
                      <dd className="break-all font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              </DetailsDisclosure>
            </article>
          );
        }

        // A `direct` confirmation is a quiet muted line, never a card.
        if (item.resolution === 'direct') {
          return (
            <p
              key={item.key}
              className="text-xs text-muted-foreground"
              data-testid="config-resolution-group-direct"
              data-resolution="direct"
            >
              {item.label}
            </p>
          );
        }

        const memberCount = item.members.length;
        return (
          <article
            key={item.key}
            className="rounded-lg border border-border bg-muted/20 p-3"
            data-testid={`config-resolution-group-${item.resolution}`}
            data-resolution={item.resolution}
          >
            <div className="space-y-1">
              {/*
                Lead with the message, not the label. Groups are keyed on
                (resolution, label, message), so several groups routinely share
                one label — every card then read "Compatibility unknown" while
                the only thing telling them apart (predates checks / already
                applied / target collision / staging failed) sat at the bottom
                in muted text. The reason is the headline; the compatibility
                state is context for it.
              */}
              <p className="text-sm font-medium">{item.message || item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.message && (
                  <>
                    <span>{item.label}</span>
                    <span aria-hidden="true"> · </span>
                  </>
                )}
                <span>
                  {`${memberCount} ${memberCount === 1 ? 'setting' : 'settings'}`}
                </span>
              </p>
              <div className="space-y-1">
                {item.members.map((member) => (
                  <div
                    key={member.captureId}
                    className="flex items-start justify-between gap-3"
                  >
                    {moduleDisplayNames[member.moduleId] && (
                      <span className="min-w-0 text-xs font-medium text-foreground">
                        {moduleDisplayNames[member.moduleId]}
                      </span>
                    )}
                    <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                      {member.status}
                    </span>
                  </div>
                ))}
              </div>
              {distinctRemediations(item.members).map((remediation) => (
                <p key={remediation} className="text-xs text-muted-foreground">
                  {remediation}
                </p>
              ))}
            </div>
            <DetailsDisclosure title="Configuration details" className="mt-3">
              <div className="space-y-3">
                {item.members.map((member) => (
                  <div
                    key={member.captureId}
                    data-testid={`config-resolution-${member.captureId}`}
                  >
                    {moduleDisplayNames[member.moduleId] && (
                      <p className="text-xs font-medium text-foreground">
                        {moduleDisplayNames[member.moduleId]}
                      </p>
                    )}
                    <dl className="space-y-1 text-xs text-muted-foreground">
                      {provenanceEntries(member).map(([label, value]) => (
                        <div key={label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                          <dt>{label}</dt>
                          <dd className="break-all font-mono">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </DetailsDisclosure>
          </article>
        );
      })}
    </section>
  );
}

/**
 * Split ambiguous-target rows out as individual decision cards and group the
 * rest by their composite `(resolution, label, message)` key, preserving
 * first-occurrence order.
 */
function buildRenderItems(resolutions: ConfigResolution[]): RenderItem[] {
  const items: RenderItem[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const resolution of resolutions) {
    if (resolution.reason === 'ambiguous_target_instance') {
      items.push({ kind: 'individual', resolution });
      continue;
    }

    const key = groupKey(resolution);
    const existingIndex = groupIndexByKey.get(key);
    if (existingIndex === undefined) {
      groupIndexByKey.set(key, items.length);
      items.push({
        kind: 'group',
        key,
        resolution: resolution.resolution,
        label: resolution.label,
        message: resolution.message,
        members: [resolution],
      });
    } else {
      (items[existingIndex] as ResolutionGroup).members.push(resolution);
    }
  }

  return items;
}

/** Collision-safe composite key over the engine-owned grouping fields. */
function groupKey(resolution: ConfigResolution): string {
  return JSON.stringify([resolution.resolution, resolution.label, resolution.message]);
}

function distinctRemediations(members: ConfigResolution[]): string[] {
  const seen: string[] = [];
  for (const member of members) {
    if (member.remediation !== null && !seen.includes(member.remediation)) {
      seen.push(member.remediation);
    }
  }
  return seen;
}

function provenanceEntries(resolution: ConfigResolution): Array<[string, string]> {
  const entries: Array<[string, string | undefined | null]> = [
    ['Capture ID', resolution.captureId],
    ['Module ID', resolution.moduleId],
    ['Config set ID', resolution.configSetId],
    ['Source instance', resolution.sourceInstance
      ? JSON.stringify(resolution.sourceInstance)
      : undefined],
    ['Source instance ID', resolution.sourceInstanceId],
    ['Target instance ID', resolution.targetInstanceId],
    ['Target candidates', JSON.stringify(resolution.targetCandidates)],
    ['Source generation', resolution.sourceGeneration],
    ['Source fingerprint', resolution.sourceGenerationFingerprint],
    ['Target generation', resolution.targetGeneration],
    ['Migration path', JSON.stringify(resolution.migrationPath)],
    ['Capture module revision', resolution.captureModuleRevision],
    ['Restore module revision', resolution.restoreModuleRevision],
    ['Resolved targets', JSON.stringify(resolution.resolvedTargets)],
    ['Reason', resolution.reason],
  ];

  return entries.filter((entry): entry is [string, string] => entry[1] != null);
}
