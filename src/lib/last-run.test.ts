import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./storage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

import {
  saveLastRun,
  loadLastRunForCommand,
  loadAllLastRuns,
  migrateLegacyLastRun,
  loadLastRun,
  type LastRunData,
} from './last-run';
import { getItem, setItem } from './storage';

const mockedGetItem = vi.mocked(getItem);
const mockedSetItem = vi.mocked(setItem);

function makeLastRunData(overrides: Partial<LastRunData> = {}): LastRunData {
  return {
    timestamp: '2026-03-28T12:00:00Z',
    command: 'capture',
    outcome: { succeeded: 10, skipped: 0, failed: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveLastRun', () => {
  it('saves capture data to the capture key', () => {
    const data = makeLastRunData({ command: 'capture' });
    saveLastRun(data);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'endstate-last-run-capture',
      JSON.stringify(data),
    );
  });

  it('saves apply data to the apply key', () => {
    const data = makeLastRunData({ command: 'apply', outcome: { installed: 5 } });
    saveLastRun(data);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'endstate-last-run-apply',
      JSON.stringify(data),
    );
  });

  it('saves verify data to the verify key', () => {
    const data = makeLastRunData({ command: 'verify', outcome: { missing: 2 } });
    saveLastRun(data);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'endstate-last-run-verify',
      JSON.stringify(data),
    );
  });

  it('does not throw on setItem failure', () => {
    mockedSetItem.mockImplementationOnce(() => { throw new Error('quota'); });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => saveLastRun(makeLastRunData())).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('loadLastRunForCommand', () => {
  it('returns parsed data for capture', () => {
    const data = makeLastRunData({ command: 'capture' });
    mockedGetItem.mockReturnValue(JSON.stringify(data));
    expect(loadLastRunForCommand('capture')).toEqual(data);
    expect(mockedGetItem).toHaveBeenCalledWith('endstate-last-run-capture');
  });

  it('returns parsed data for apply', () => {
    const data = makeLastRunData({ command: 'apply' });
    mockedGetItem.mockReturnValue(JSON.stringify(data));
    expect(loadLastRunForCommand('apply')).toEqual(data);
    expect(mockedGetItem).toHaveBeenCalledWith('endstate-last-run-apply');
  });

  it('returns parsed data for verify', () => {
    const data = makeLastRunData({ command: 'verify' });
    mockedGetItem.mockReturnValue(JSON.stringify(data));
    expect(loadLastRunForCommand('verify')).toEqual(data);
    expect(mockedGetItem).toHaveBeenCalledWith('endstate-last-run-verify');
  });

  it('returns null when no data stored', () => {
    mockedGetItem.mockReturnValue(null);
    expect(loadLastRunForCommand('capture')).toBeNull();
  });

  it('returns null on parse error', () => {
    mockedGetItem.mockReturnValue('not-valid-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadLastRunForCommand('capture')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('loadAllLastRuns', () => {
  it('returns all three commands', () => {
    const captureData = makeLastRunData({ command: 'capture' });
    const applyData = makeLastRunData({ command: 'apply', outcome: { installed: 3 } });
    mockedGetItem.mockImplementation((key: string) => {
      if (key === 'endstate-last-run-capture') return JSON.stringify(captureData);
      if (key === 'endstate-last-run-apply') return JSON.stringify(applyData);
      return null;
    });

    const result = loadAllLastRuns();
    expect(result.capture).toEqual(captureData);
    expect(result.apply).toEqual(applyData);
    expect(result.verify).toBeNull();
  });

  it('returns all null when nothing is stored', () => {
    mockedGetItem.mockReturnValue(null);
    const result = loadAllLastRuns();
    expect(result).toEqual({ capture: null, apply: null, verify: null });
  });
});

describe('migrateLegacyLastRun', () => {
  it('does nothing when no legacy data exists', () => {
    mockedGetItem.mockReturnValue(null);
    migrateLegacyLastRun();
    expect(mockedSetItem).not.toHaveBeenCalled();
  });

  it('migrates legacy data to the per-command key', () => {
    const legacyData = makeLastRunData({ command: 'apply', outcome: { installed: 7 } });
    mockedGetItem.mockReturnValue(JSON.stringify(legacyData));
    migrateLegacyLastRun();
    expect(mockedGetItem).toHaveBeenCalledWith('endstate-last-run');
    expect(mockedSetItem).toHaveBeenCalledWith(
      'endstate-last-run-apply',
      JSON.stringify(legacyData),
    );
  });

  it('does not throw on parse error', () => {
    mockedGetItem.mockReturnValue('bad-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => migrateLegacyLastRun()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not migrate when legacy data has no command field', () => {
    mockedGetItem.mockReturnValue(JSON.stringify({ timestamp: '2026-01-01T00:00:00Z' }));
    migrateLegacyLastRun();
    expect(mockedSetItem).not.toHaveBeenCalled();
  });
});

describe('loadLastRun (deprecated)', () => {
  it('returns legacy data from legacy key', () => {
    const legacyData = makeLastRunData({ command: 'capture' });
    mockedGetItem.mockReturnValue(JSON.stringify(legacyData));
    expect(loadLastRun()).toEqual(legacyData);
    expect(mockedGetItem).toHaveBeenCalledWith('endstate-last-run');
  });

  it('returns null when no legacy data', () => {
    mockedGetItem.mockReturnValue(null);
    expect(loadLastRun()).toBeNull();
  });

  it('returns null on parse error', () => {
    mockedGetItem.mockReturnValue('bad-json');
    expect(loadLastRun()).toBeNull();
  });
});
