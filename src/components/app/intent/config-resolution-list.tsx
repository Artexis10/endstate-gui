import type { ConfigResolution, RestoreTargetMapping } from '@/types';
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

  return (
    <section className="space-y-2" aria-label="Settings compatibility">
      {resolutions.map((resolution) => (
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
      ))}
    </section>
  );
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
