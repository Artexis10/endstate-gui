import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./engine-exec', () => ({ runEndstateOnce: vi.fn() }));

import { runEndstateOnce } from './engine-exec';
import { backupRename } from './backup-bridge';
import type { AppSettings } from '../settings';

const SETTINGS = {} as AppSettings;

beforeEach(() => {
  vi.mocked(runEndstateOnce).mockReset();
});

describe('backupRename', () => {
  it('invokes `backup rename --backup-id <id> --name <name>` and returns the data', async () => {
    vi.mocked(runEndstateOnce).mockResolvedValue({
      success: true,
      envelope: { success: true, data: { backupId: 'b1', name: 'Gaming Rig', updatedAt: 't' } },
    } as never);

    const data = await backupRename(SETTINGS, { backupId: 'b1', name: 'Gaming Rig' });

    expect(data).toEqual({ backupId: 'b1', name: 'Gaming Rig', updatedAt: 't' });
    const call = vi.mocked(runEndstateOnce).mock.calls[0];
    expect(call[1]).toBe('backup');
    expect(call[2]).toEqual(['rename', '--backup-id', 'b1', '--name', 'Gaming Rig']);
  });
});
