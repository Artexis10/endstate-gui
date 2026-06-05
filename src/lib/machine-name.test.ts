import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./tauri-bridge', () => ({ safeInvoke: vi.fn() }));

import { safeInvoke } from './tauri-bridge';
import { getMachineName } from './machine-name';

const mockInvoke = vi.mocked(safeInvoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('getMachineName', () => {
  it('returns the hostname from the engine command', async () => {
    mockInvoke.mockResolvedValue('HUGO-LAPTOP');
    await expect(getMachineName()).resolves.toBe('HUGO-LAPTOP');
    expect(mockInvoke).toHaveBeenCalledWith('get_hostname');
  });

  it('trims surrounding whitespace', async () => {
    mockInvoke.mockResolvedValue('  DESKTOP-1  ');
    await expect(getMachineName()).resolves.toBe('DESKTOP-1');
  });

  it('falls back to "This computer" when the command rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('not available'));
    await expect(getMachineName()).resolves.toBe('This computer');
  });

  it('falls back to "This computer" when the command returns an empty string', async () => {
    mockInvoke.mockResolvedValue('   ');
    await expect(getMachineName()).resolves.toBe('This computer');
  });
});
