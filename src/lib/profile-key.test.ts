import { describe, it, expect } from 'vitest';
import { profileKeyFor } from './profile-key';
import type { DiscoveredProfile } from '../file-discovery';

describe('profileKeyFor', () => {
  it('returns the absolute path as the stable key', () => {
    expect(profileKeyFor({ path: 'C:\\profiles\\work-laptop.jsonc' })).toBe(
      'C:\\profiles\\work-laptop.jsonc',
    );
  });

  it('distinguishes two profiles that share a name but differ by path', () => {
    const a = profileKeyFor({ path: 'C:\\a\\gaming.jsonc' });
    const b = profileKeyFor({ path: 'C:\\b\\gaming.jsonc' });
    expect(a).not.toBe(b);
  });

  it('ignores name/displayName when deriving the key', () => {
    const profile: DiscoveredProfile = {
      path: 'C:\\p.jsonc',
      name: 'one',
      displayName: 'One',
    };
    expect(profileKeyFor(profile)).toBe('C:\\p.jsonc');
  });
});
