import { describe, it, expect } from 'vitest';
import {
  engineSupportsApplyOnly,
  engineSupportsApplyRestoreTarget,
} from './apply-capabilities';
import type { EndstateCapabilitiesData } from '../types';

/** Build a capabilities payload in the real engine's map shape. */
function capsWithApplyFlags(flags: string[]): EndstateCapabilitiesData {
  return {
    commands: {
      apply: { supported: true, flags },
    },
  } as unknown as EndstateCapabilitiesData;
}

describe('engineSupportsApplyOnly', () => {
  it('returns false for null/undefined capabilities', () => {
    expect(engineSupportsApplyOnly(null)).toBe(false);
    expect(engineSupportsApplyOnly(undefined)).toBe(false);
  });

  it('returns false when commands is missing', () => {
    expect(engineSupportsApplyOnly({} as EndstateCapabilitiesData)).toBe(false);
  });

  it('returns false when commands is the legacy string[] shape', () => {
    const caps = { commands: ['apply', 'verify'] } as unknown as EndstateCapabilitiesData;
    expect(engineSupportsApplyOnly(caps)).toBe(false);
  });

  it('returns false when apply flags do not include --only', () => {
    expect(
      engineSupportsApplyOnly(capsWithApplyFlags(['--manifest', '--dry-run', '--json'])),
    ).toBe(false);
  });

  it('returns true when apply flags include --only', () => {
    expect(
      engineSupportsApplyOnly(
        capsWithApplyFlags([
          '--manifest',
          '--dry-run',
          '--enable-restore',
          '--restore-filter',
          '--only',
          '--json',
          '--events',
        ]),
      ),
    ).toBe(true);
  });

  it('returns false when apply command entry is absent', () => {
    const caps = {
      commands: { verify: { supported: true, flags: ['--only'] } },
    } as unknown as EndstateCapabilitiesData;
    expect(engineSupportsApplyOnly(caps)).toBe(false);
  });
});

describe('engineSupportsApplyRestoreTarget', () => {
  it('activates only when apply advertises --restore-target', () => {
    expect(engineSupportsApplyRestoreTarget(capsWithApplyFlags(['--restore-target']))).toBe(true);
    expect(engineSupportsApplyRestoreTarget(capsWithApplyFlags(['--only']))).toBe(false);
    expect(engineSupportsApplyRestoreTarget(undefined)).toBe(false);
  });
});
