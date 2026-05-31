import { describe, it, expect, vi, beforeEach } from 'vitest';

const streamingMock = vi.fn();
vi.mock('../streaming-runner', () => ({
  runEndstateStreaming: (...args: unknown[]) => streamingMock(...args),
}));

import { backupPush } from './backup-bridge';
import type { AppSettings } from '../settings';

const SETTINGS = {} as AppSettings;

beforeEach(() => {
  streamingMock.mockReset();
});

function pushCliArgs(): string[] {
  return streamingMock.mock.calls[0][2] as string[];
}

describe('backupPush --if-changed', () => {
  it('appends --if-changed when ifChanged is set', async () => {
    streamingMock.mockResolvedValue({
      envelope: { success: true, data: { backupId: 'b1', versionId: 'v1' } },
      exitCode: 0,
    });
    await backupPush(SETTINGS, { profile: 'C:\\p.json', ifChanged: true });
    expect(pushCliArgs()).toContain('--if-changed');
  });

  it('omits --if-changed by default', async () => {
    streamingMock.mockResolvedValue({
      envelope: { success: true, data: { backupId: 'b1', versionId: 'v1' } },
      exitCode: 0,
    });
    await backupPush(SETTINGS, { profile: 'C:\\p.json' });
    expect(pushCliArgs()).not.toContain('--if-changed');
  });

  it('returns a skipped/unchanged result without throwing', async () => {
    streamingMock.mockResolvedValue({
      envelope: { success: true, data: { backupId: 'b1', skipped: true } },
      exitCode: 0,
    });
    const data = await backupPush(SETTINGS, { profile: 'C:\\p.json', ifChanged: true });
    expect(data.skipped).toBe(true);
    expect(data.versionId).toBeUndefined();
  });
});
