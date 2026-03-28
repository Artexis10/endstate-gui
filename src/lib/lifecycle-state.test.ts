import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the storage module before importing the module under test
vi.mock('./storage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

import {
  loadLifecycleState,
  saveLifecycleState,
  recordLifecycleEvent,
  hasRecentScan,
  getMostRecentScan,
  clearLifecycleState,
  formatRelativeTime,
  type LifecycleState,
  type LifecycleEvent,
} from './lifecycle-state';
import { getItem, setItem } from './storage';

const mockedGetItem = vi.mocked(getItem);
const mockedSetItem = vi.mocked(setItem);

function makeEvent(overrides: Partial<LifecycleEvent> = {}): LifecycleEvent {
  return {
    timestamp: '2026-03-28T12:00:00Z',
    success: true,
    ...overrides,
  };
}

function makeEmptyState(): LifecycleState {
  return {
    lastCapture: null,
    lastPreview: null,
    lastApply: null,
    lastVerify: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadLifecycleState', () => {
  it('returns default state when nothing is stored', () => {
    mockedGetItem.mockReturnValue(null);
    expect(loadLifecycleState()).toEqual(makeEmptyState());
  });

  it('parses stored JSON and merges with defaults', () => {
    const capture = makeEvent();
    mockedGetItem.mockReturnValue(JSON.stringify({ lastCapture: capture }));
    const result = loadLifecycleState();
    expect(result.lastCapture).toEqual(capture);
    expect(result.lastPreview).toBeNull();
    expect(result.lastApply).toBeNull();
    expect(result.lastVerify).toBeNull();
  });

  it('returns default state on invalid JSON', () => {
    mockedGetItem.mockReturnValue('not-valid-json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = loadLifecycleState();
    expect(result).toEqual(makeEmptyState());
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('reads from the correct storage key', () => {
    mockedGetItem.mockReturnValue(null);
    loadLifecycleState();
    expect(mockedGetItem).toHaveBeenCalledWith('endstate-lifecycle-state');
  });
});

describe('saveLifecycleState', () => {
  it('saves serialized state to storage', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastCapture: makeEvent(),
    };
    saveLifecycleState(state);
    expect(mockedSetItem).toHaveBeenCalledWith(
      'endstate-lifecycle-state',
      JSON.stringify(state),
    );
  });

  it('does not throw on setItem failure', () => {
    mockedSetItem.mockImplementationOnce(() => { throw new Error('quota'); });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => saveLifecycleState(makeEmptyState())).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('recordLifecycleEvent', () => {
  beforeEach(() => {
    // loadLifecycleState will be called inside recordLifecycleEvent
    mockedGetItem.mockReturnValue(JSON.stringify(makeEmptyState()));
  });

  it('records a capture event', () => {
    const event = makeEvent({ summary: { total: 10 } });
    const result = recordLifecycleEvent('capture', event);
    expect(result.lastCapture).toEqual(event);
  });

  it('records a preview event', () => {
    const event = makeEvent({ profile: 'test' });
    const result = recordLifecycleEvent('preview', event);
    expect(result.lastPreview).toEqual(event);
  });

  it('records an apply event', () => {
    const event = makeEvent({ summary: { installed: 5 } });
    const result = recordLifecycleEvent('apply', event);
    expect(result.lastApply).toEqual(event);
  });

  it('clears preview after successful apply', () => {
    const preview = makeEvent({ profile: 'test' });
    mockedGetItem.mockReturnValue(JSON.stringify({ ...makeEmptyState(), lastPreview: preview }));
    const applyEvent = makeEvent({ success: true, summary: { installed: 5 } });
    const result = recordLifecycleEvent('apply', applyEvent);
    expect(result.lastApply).toEqual(applyEvent);
    expect(result.lastPreview).toBeNull();
  });

  it('does NOT clear preview after failed apply', () => {
    const preview = makeEvent({ profile: 'test' });
    mockedGetItem.mockReturnValue(JSON.stringify({ ...makeEmptyState(), lastPreview: preview }));
    const applyEvent = makeEvent({ success: false });
    const result = recordLifecycleEvent('apply', applyEvent);
    expect(result.lastApply).toEqual(applyEvent);
    expect(result.lastPreview).toEqual(preview);
  });

  it('records a verify event', () => {
    const event = makeEvent({ summary: { missing: 2 } });
    const result = recordLifecycleEvent('verify', event);
    expect(result.lastVerify).toEqual(event);
  });

  it('saves state to storage after recording', () => {
    const event = makeEvent();
    recordLifecycleEvent('capture', event);
    expect(mockedSetItem).toHaveBeenCalled();
  });
});

describe('hasRecentScan', () => {
  it('returns false for empty state', () => {
    expect(hasRecentScan(makeEmptyState(), '/path/to/profile')).toBe(false);
  });

  it('returns true for recent preview matching profile', () => {
    const now = new Date();
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({
        timestamp: now.toISOString(),
        profilePath: '/path/to/profile',
      }),
    };
    expect(hasRecentScan(state, '/path/to/profile')).toBe(true);
  });

  it('returns false for preview with different profile path', () => {
    const now = new Date();
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({
        timestamp: now.toISOString(),
        profilePath: '/different/path',
      }),
    };
    expect(hasRecentScan(state, '/path/to/profile')).toBe(false);
  });

  it('returns false for old preview beyond maxAge', () => {
    const old = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({
        timestamp: old.toISOString(),
        profilePath: '/path/to/profile',
      }),
    };
    expect(hasRecentScan(state, '/path/to/profile')).toBe(false);
  });

  it('returns true for recent verify matching profile', () => {
    const now = new Date();
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({
        timestamp: now.toISOString(),
        profilePath: '/path/to/profile',
      }),
    };
    expect(hasRecentScan(state, '/path/to/profile')).toBe(true);
  });

  it('returns false for verify with different profile path', () => {
    const now = new Date();
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({
        timestamp: now.toISOString(),
        profilePath: '/other',
      }),
    };
    expect(hasRecentScan(state, '/path/to/profile')).toBe(false);
  });

  it('respects custom maxAgeMs', () => {
    const twoSecondsAgo = new Date(Date.now() - 2000);
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({
        timestamp: twoSecondsAgo.toISOString(),
        profilePath: '/path',
      }),
    };
    // 1 second max age => false
    expect(hasRecentScan(state, '/path', 1000)).toBe(false);
    // 5 second max age => true
    expect(hasRecentScan(state, '/path', 5000)).toBe(true);
  });

  it('checks preview before verify (returns true on preview match even if verify mismatches)', () => {
    const now = new Date();
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({
        timestamp: now.toISOString(),
        profilePath: '/path',
      }),
      lastVerify: makeEvent({
        timestamp: now.toISOString(),
        profilePath: '/different',
      }),
    };
    expect(hasRecentScan(state, '/path')).toBe(true);
  });
});

describe('getMostRecentScan', () => {
  it('returns null when no scans match the profile', () => {
    expect(getMostRecentScan(makeEmptyState(), '/path')).toBeNull();
  });

  it('returns matching preview when no verify', () => {
    const preview = makeEvent({ profilePath: '/path' });
    const state: LifecycleState = { ...makeEmptyState(), lastPreview: preview };
    expect(getMostRecentScan(state, '/path')).toBe(preview);
  });

  it('returns matching verify when no preview', () => {
    const verify = makeEvent({ profilePath: '/path' });
    const state: LifecycleState = { ...makeEmptyState(), lastVerify: verify };
    expect(getMostRecentScan(state, '/path')).toBe(verify);
  });

  it('returns null when events exist but profile does not match', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({ profilePath: '/other' }),
      lastVerify: makeEvent({ profilePath: '/other' }),
    };
    expect(getMostRecentScan(state, '/path')).toBeNull();
  });

  it('returns the more recent between preview and verify', () => {
    const olderPreview = makeEvent({ timestamp: '2026-03-28T10:00:00Z', profilePath: '/path' });
    const newerVerify = makeEvent({ timestamp: '2026-03-28T14:00:00Z', profilePath: '/path' });
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: olderPreview,
      lastVerify: newerVerify,
    };
    expect(getMostRecentScan(state, '/path')).toBe(newerVerify);
  });

  it('returns preview when preview is more recent than verify', () => {
    const newerPreview = makeEvent({ timestamp: '2026-03-28T14:00:00Z', profilePath: '/path' });
    const olderVerify = makeEvent({ timestamp: '2026-03-28T10:00:00Z', profilePath: '/path' });
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: newerPreview,
      lastVerify: olderVerify,
    };
    expect(getMostRecentScan(state, '/path')).toBe(newerPreview);
  });
});

describe('clearLifecycleState', () => {
  it('saves default empty state to storage', () => {
    mockedGetItem.mockReturnValue(null);
    clearLifecycleState();
    expect(mockedSetItem).toHaveBeenCalledWith(
      'endstate-lifecycle-state',
      JSON.stringify(makeEmptyState()),
    );
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for less than 60 seconds ago', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('just now');
  });

  it('returns "Xm ago" for minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo.toISOString())).toBe('5m ago');
  });

  it('returns "Xh ago" for hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3h ago');
  });

  it('returns "yesterday" for 1 day ago', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(yesterday.toISOString())).toBe('yesterday');
  });

  it('returns "X days ago" for multiple days', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(fiveDaysAgo.toISOString())).toBe('5 days ago');
  });

  it('returns "1m ago" at the 60 second boundary', () => {
    const sixtySecsAgo = new Date(Date.now() - 60 * 1000);
    expect(formatRelativeTime(sixtySecsAgo.toISOString())).toBe('1m ago');
  });
});
