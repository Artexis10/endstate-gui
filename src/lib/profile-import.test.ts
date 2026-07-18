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
  it('finds the exact manifest path returned by an import command', () => {
    expect(findImportedProfile(profiles, 'C:\\test\\profiles\\captured-bundle\\manifest.jsonc')).toEqual(
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

  it('does not select an arbitrary descendant when only a directory is returned', () => {
    expect(findImportedProfile(profiles, 'C:\\test\\profiles\\captured-bundle')).toBeNull();
  });

  it('preserves case-sensitive exact matching for POSIX paths', () => {
    const posixProfiles: DiscoveredProfile[] = [
      { name: 'captured', path: '/profiles/Captured/manifest.jsonc' },
    ];

    expect(findImportedProfile(posixProfiles, '/profiles/captured/manifest.jsonc')).toBeNull();
    expect(findImportedProfile(posixProfiles, '/profiles/Captured/manifest.jsonc')).toEqual(posixProfiles[0]);
  });
});
