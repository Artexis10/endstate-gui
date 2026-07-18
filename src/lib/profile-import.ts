import type { DiscoveredProfile } from '@/file-discovery';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * Resolve the profile created by an import command. Zip imports return an
 * extraction directory; manifest imports return the destination file path.
 */
export function findImportedProfile(
  profiles: DiscoveredProfile[],
  importedPath: string,
): DiscoveredProfile | null {
  const target = normalizePath(importedPath);
  if (!target) return null;

  return profiles.find((profile) => {
    const profilePath = normalizePath(profile.path);
    return profilePath === target || profilePath.startsWith(`${target}/`);
  }) ?? null;
}
