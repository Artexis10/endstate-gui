import type { DiscoveredProfile } from '@/file-discovery';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** Resolve the exact manifest path committed by an import command. */
export function findImportedProfile(
  profiles: DiscoveredProfile[],
  importedPath: string,
): DiscoveredProfile | null {
  const target = normalizePath(importedPath);
  if (!target) return null;

  return profiles.find((profile) => {
    const profilePath = normalizePath(profile.path);
    return profilePath === target;
  }) ?? null;
}
