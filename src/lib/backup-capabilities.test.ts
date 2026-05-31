import { describe, it, expect } from 'vitest';
import {
  engineSupportsIfChanged,
  autoBackupAvailable,
  isAutoBackupActive,
} from './backup-capabilities';
import type { EndstateCapabilitiesData, BackupStatusData } from '../types';

describe('engineSupportsIfChanged', () => {
  it('is false for null/empty capabilities (dark by default)', () => {
    expect(engineSupportsIfChanged(null)).toBe(false);
    expect(engineSupportsIfChanged(undefined)).toBe(false);
    expect(engineSupportsIfChanged({} as EndstateCapabilitiesData)).toBe(false);
  });

  it('is false when backup flags do not include --if-changed (engine #62 unlanded)', () => {
    const caps = {
      commands: { backup: { supported: true, flags: ['--profile', '--name', '--json'] } },
    } as unknown as EndstateCapabilitiesData;
    expect(engineSupportsIfChanged(caps)).toBe(false);
  });

  it('is true when the backup command advertises --if-changed', () => {
    const caps = {
      commands: { backup: { supported: true, flags: ['--profile', '--if-changed', '--json'] } },
    } as unknown as EndstateCapabilitiesData;
    expect(engineSupportsIfChanged(caps)).toBe(true);
  });

  it('honors a boolean fallback on the hostedBackup capability', () => {
    const caps = {
      features: { hostedBackup: { supported: true, ifChanged: true } },
    } as EndstateCapabilitiesData;
    expect(engineSupportsIfChanged(caps)).toBe(true);
  });

  it('does not crash when commands is the legacy string[] shape', () => {
    const caps = { commands: ['backup', 'capture'] } as unknown as EndstateCapabilitiesData;
    expect(engineSupportsIfChanged(caps)).toBe(false);
  });
});

const ACTIVE_STATUS: BackupStatusData = {
  signedIn: true,
  subscriptionStatus: 'active',
  issuerUrl: 'https://substratesystems.io',
};

describe('autoBackupAvailable', () => {
  it('is true when supported + if-changed + signed-in + active', () => {
    expect(
      autoBackupAvailable({
        hostedBackupSupported: true,
        ifChangedSupported: true,
        status: ACTIVE_STATUS,
      }),
    ).toBe(true);
  });

  it.each([
    ['hosted backup unsupported', { hostedBackupSupported: false, ifChangedSupported: true, status: ACTIVE_STATUS }],
    ['engine lacks --if-changed', { hostedBackupSupported: true, ifChangedSupported: false, status: ACTIVE_STATUS }],
    ['signed out', { hostedBackupSupported: true, ifChangedSupported: true, status: { ...ACTIVE_STATUS, signedIn: false } }],
    ['no subscription', { hostedBackupSupported: true, ifChangedSupported: true, status: { ...ACTIVE_STATUS, subscriptionStatus: 'none' as const } }],
    ['null status', { hostedBackupSupported: true, ifChangedSupported: true, status: null }],
  ])('is false when %s', (_label, conditions) => {
    expect(autoBackupAvailable(conditions)).toBe(false);
  });
});

describe('isAutoBackupActive', () => {
  const base = { hostedBackupSupported: true, ifChangedSupported: true, status: ACTIVE_STATUS };

  it('is true only when available AND opted in', () => {
    expect(isAutoBackupActive({ ...base, autoBackupEnabled: true })).toBe(true);
  });

  it('is false when opted out even if available', () => {
    expect(isAutoBackupActive({ ...base, autoBackupEnabled: false })).toBe(false);
  });

  it('is false when not available even if opted in', () => {
    expect(
      isAutoBackupActive({ ...base, ifChangedSupported: false, autoBackupEnabled: true }),
    ).toBe(false);
  });
});
