import type { RestoreTargetMapping } from '../types';

export function buildRestoreTargetArgs(
  mappings: RestoreTargetMapping[],
): string[] {
  return mappings.flatMap(({ captureId, targetInstanceId }) => [
    '--restore-target',
    `${captureId}=${targetInstanceId}`,
  ]);
}
