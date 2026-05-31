import { describe, it, expect, vi, beforeEach } from 'vitest';

const backupPushMock = vi.fn();
vi.mock('./backup-bridge', async () => {
  const actual = await vi.importActual<typeof import('./backup-bridge')>('./backup-bridge');
  return { ...actual, backupPush: (...a: unknown[]) => backupPushMock(...a) };
});

import { runAutoBackup } from './auto-backup';
import { BackupCommandError } from './backup-bridge';
import type { AppSettings } from '../settings';

function settingsWith(profileBackupIds: Record<string, string>): AppSettings {
  return { profileBackupIds } as AppSettings;
}

beforeEach(() => {
  backupPushMock.mockReset();
});

describe('runAutoBackup outcome mapping', () => {
  it('maps a new version to "uploaded"', async () => {
    backupPushMock.mockResolvedValue({ backupId: 'b1', versionId: 'v1' });
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out).toEqual({ kind: 'uploaded', backupId: 'b1', versionId: 'v1' });
  });

  it('maps an explicit skipped result to "skipped" (carrying backupId)', async () => {
    backupPushMock.mockResolvedValue({ backupId: 'b1', skipped: true });
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out).toEqual({ kind: 'skipped', backupId: 'b1' });
  });

  it('treats a missing versionId as skipped', async () => {
    backupPushMock.mockResolvedValue({ backupId: 'b1' });
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out.kind).toBe('skipped');
  });

  it('maps AUTH_REQUIRED to "auth-required"', async () => {
    backupPushMock.mockRejectedValue(
      new BackupCommandError({ code: 'AUTH_REQUIRED', message: 'x' }),
    );
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out).toEqual({ kind: 'auth-required' });
  });

  it('maps STORAGE_QUOTA_EXCEEDED to "quota-exceeded"', async () => {
    backupPushMock.mockRejectedValue(
      new BackupCommandError({ code: 'STORAGE_QUOTA_EXCEEDED', message: 'x' }),
    );
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out).toEqual({ kind: 'quota-exceeded' });
  });

  it('maps a transient/network error to a silent "error"', async () => {
    backupPushMock.mockRejectedValue(
      new BackupCommandError({ code: 'BACKEND_UNREACHABLE', message: 'x' }),
    );
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out).toEqual({ kind: 'error' });
  });

  it('maps a non-BackupCommandError throw to "error"', async () => {
    backupPushMock.mockRejectedValue(new Error('boom'));
    const out = await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'p',
    });
    expect(out).toEqual({ kind: 'error' });
  });
});

describe('runAutoBackup profile→backup association', () => {
  it('first push omits --backup-id and passes --name', async () => {
    backupPushMock.mockResolvedValue({ backupId: 'b-new', versionId: 'v1' });
    await runAutoBackup({
      settings: settingsWith({}),
      profilePath: 'C:\\p.json',
      profileKey: 'work-laptop',
      name: 'work-laptop',
    });
    const pushArgs = backupPushMock.mock.calls[0][1];
    expect(pushArgs.ifChanged).toBe(true);
    expect(pushArgs.backupId).toBeUndefined();
    expect(pushArgs.name).toBe('work-laptop');
  });

  it('subsequent push targets the stored --backup-id and omits --name', async () => {
    backupPushMock.mockResolvedValue({ backupId: 'b9', versionId: 'v2' });
    await runAutoBackup({
      settings: settingsWith({ 'work-laptop': 'b9' }),
      profilePath: 'C:\\p.json',
      profileKey: 'work-laptop',
      name: 'work-laptop',
    });
    const pushArgs = backupPushMock.mock.calls[0][1];
    expect(pushArgs.backupId).toBe('b9');
    expect(pushArgs.name).toBeUndefined();
  });
});
