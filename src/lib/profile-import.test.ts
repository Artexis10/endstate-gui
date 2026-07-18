import { describe, expect, it } from 'vitest';
import type { DiscoveredProfile } from '@/file-discovery';
import { findImportedProfile } from './profile-import';

const profiles: DiscoveredProfile[] = [
  {
    name: 'existing',
    path: 'C:\\test\\profiles\\existing.jsonc',
  },
  {
    name: 'captured-bundle',
    path: 'C:\\test\\profiles\\captured-bundle\\manifest.jsonc',
  },
];

describe('findImportedProfile', () => {
  it('finds the manifest discovered under an extracted bundle directory', () => {
    expect(findImportedProfile(profiles, 'C:\\test\\profiles\\captured-bundle')).toEqual(
      profiles[1],
    );
  });

  it('finds a directly imported manifest path case-insensitively', () => {
    expect(findImportedProfile(profiles, 'c:/test/profiles/EXISTING.jsonc')).toEqual(
      profiles[0],
    );
  });

  it('does not confuse a sibling directory with a shared prefix', () => {
    expect(findImportedProfile(profiles, 'C:\\test\\profiles\\captured')).toBeNull();
  });
});
