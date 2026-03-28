import { describe, it, expect } from 'vitest';
import { getLastEvent, formatLastEventSummary, buildRecentActivity } from './selectors';
import type { LifecycleState, LifecycleEvent } from '@/lib/lifecycle-state';

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

describe('getLastEvent', () => {
  it('returns lastCapture for action "capture"', () => {
    const capture = makeEvent();
    const state: LifecycleState = { ...makeEmptyState(), lastCapture: capture };
    expect(getLastEvent(state, 'capture')).toBe(capture);
  });

  it('returns null for capture when no lastCapture', () => {
    expect(getLastEvent(makeEmptyState(), 'capture')).toBeNull();
  });

  it('returns lastApply for action "setup" when both apply and preview exist', () => {
    const apply = makeEvent({ timestamp: '2026-03-28T13:00:00Z' });
    const preview = makeEvent({ timestamp: '2026-03-28T12:00:00Z' });
    const state: LifecycleState = { ...makeEmptyState(), lastApply: apply, lastPreview: preview };
    expect(getLastEvent(state, 'setup')).toBe(apply);
  });

  it('returns lastPreview for action "setup" when no apply exists', () => {
    const preview = makeEvent();
    const state: LifecycleState = { ...makeEmptyState(), lastPreview: preview };
    expect(getLastEvent(state, 'setup')).toBe(preview);
  });

  it('returns null for setup when neither apply nor preview exist', () => {
    expect(getLastEvent(makeEmptyState(), 'setup')).toBeNull();
  });

  it('returns lastVerify for action "check" when both verify and preview exist', () => {
    const verify = makeEvent({ timestamp: '2026-03-28T13:00:00Z' });
    const preview = makeEvent({ timestamp: '2026-03-28T12:00:00Z' });
    const state: LifecycleState = { ...makeEmptyState(), lastVerify: verify, lastPreview: preview };
    expect(getLastEvent(state, 'check')).toBe(verify);
  });

  it('returns lastPreview for action "check" when no verify exists', () => {
    const preview = makeEvent();
    const state: LifecycleState = { ...makeEmptyState(), lastPreview: preview };
    expect(getLastEvent(state, 'check')).toBe(preview);
  });

  it('returns null for check when neither verify nor preview exist', () => {
    expect(getLastEvent(makeEmptyState(), 'check')).toBeNull();
  });

  it('returns null for null action', () => {
    const state: LifecycleState = {
      lastCapture: makeEvent(),
      lastPreview: makeEvent(),
      lastApply: makeEvent(),
      lastVerify: makeEvent(),
    };
    expect(getLastEvent(state, null)).toBeNull();
  });
});

describe('formatLastEventSummary', () => {
  it('returns null when no event exists for action', () => {
    expect(formatLastEventSummary(makeEmptyState(), 'capture')).toBeNull();
  });

  it('returns app count for capture with summary.total', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastCapture: makeEvent({ summary: { total: 42 } }),
    };
    expect(formatLastEventSummary(state, 'capture')).toBe('42 apps captured');
  });

  it('returns null for capture without summary.total', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastCapture: makeEvent({ summary: {} }),
    };
    expect(formatLastEventSummary(state, 'capture')).toBeNull();
  });

  it('returns null for capture with no summary', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastCapture: makeEvent(),
    };
    expect(formatLastEventSummary(state, 'capture')).toBeNull();
  });

  it('returns installed/alreadyPresent for setup with summary.installed', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastApply: makeEvent({ summary: { installed: 5, alreadyPresent: 3 } }),
    };
    expect(formatLastEventSummary(state, 'setup')).toBe('5 installed, 3 already present');
  });

  it('defaults alreadyPresent to 0 for setup when not provided', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastApply: makeEvent({ summary: { installed: 5 } }),
    };
    expect(formatLastEventSummary(state, 'setup')).toBe('5 installed, 0 already present');
  });

  it('returns null for setup without summary.installed', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastApply: makeEvent({ summary: {} }),
    };
    expect(formatLastEventSummary(state, 'setup')).toBeNull();
  });

  it('returns missing count for check with missing > 0', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({ summary: { missing: 3 } }),
    };
    expect(formatLastEventSummary(state, 'check')).toBe('3 missing');
  });

  it('returns present count for check with alreadyPresent and no missing', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({ summary: { alreadyPresent: 10, missing: 0 } }),
    };
    expect(formatLastEventSummary(state, 'check')).toBe('10 present');
  });

  it('returns present count for check with alreadyPresent when missing is undefined', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({ summary: { alreadyPresent: 10 } }),
    };
    expect(formatLastEventSummary(state, 'check')).toBe('10 present');
  });

  it('returns null for check with no relevant summary fields', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({ summary: {} }),
    };
    expect(formatLastEventSummary(state, 'check')).toBeNull();
  });

  it('returns null for null action', () => {
    const state: LifecycleState = {
      lastCapture: makeEvent({ summary: { total: 5 } }),
      lastPreview: makeEvent({ summary: { installed: 3 } }),
      lastApply: makeEvent({ summary: { installed: 3 } }),
      lastVerify: makeEvent({ summary: { missing: 2 } }),
    };
    expect(formatLastEventSummary(state, null)).toBeNull();
  });
});

describe('buildRecentActivity', () => {
  it('returns empty array for empty state', () => {
    expect(buildRecentActivity(makeEmptyState())).toEqual([]);
  });

  it('includes capture activity with correct shape', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastCapture: makeEvent({ summary: { total: 10 } }),
    };
    const result = buildRecentActivity(state);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'capture',
      label: 'Saved computer',
      success: true,
      summary: '10 apps',
    });
  });

  it('includes capture without summary text when total is missing', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastCapture: makeEvent({ summary: {} }),
    };
    const result = buildRecentActivity(state);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'capture',
      summary: undefined,
    });
  });

  it('includes preview activity with correct shape', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastPreview: makeEvent({ profile: 'my-profile', summary: { installed: 5 } }),
    };
    const result = buildRecentActivity(state);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'preview',
      label: 'Previewed setup',
      profile: 'my-profile',
      summary: '5 to install',
    });
  });

  it('includes apply activity with correct shape', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastApply: makeEvent({ profile: 'my-profile', summary: { installed: 8 } }),
    };
    const result = buildRecentActivity(state);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'apply',
      label: 'Applied setup',
      profile: 'my-profile',
      summary: '8 installed',
    });
  });

  it('includes verify activity with missing count', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({ profile: 'my-profile', summary: { missing: 3 } }),
    };
    const result = buildRecentActivity(state);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'verify',
      label: 'Checked computer',
      summary: '3 missing',
    });
  });

  it('includes verify with present count when missing is 0', () => {
    const state: LifecycleState = {
      ...makeEmptyState(),
      lastVerify: makeEvent({ summary: { missing: 0, alreadyPresent: 10 } }),
    };
    const result = buildRecentActivity(state);
    expect(result[0]).toMatchObject({
      type: 'verify',
      summary: '10 present',
    });
  });

  it('sorts activities by timestamp descending (most recent first)', () => {
    const state: LifecycleState = {
      lastCapture: makeEvent({ timestamp: '2026-03-28T10:00:00Z' }),
      lastPreview: makeEvent({ timestamp: '2026-03-28T14:00:00Z' }),
      lastApply: makeEvent({ timestamp: '2026-03-28T12:00:00Z' }),
      lastVerify: makeEvent({ timestamp: '2026-03-28T08:00:00Z' }),
    };
    const result = buildRecentActivity(state);
    // Max 3 entries, sorted by timestamp desc
    expect(result).toHaveLength(3);
    expect(result[0]!.type).toBe('preview');
    expect(result[1]!.type).toBe('apply');
    expect(result[2]!.type).toBe('capture');
  });

  it('limits to 3 most recent entries', () => {
    const state: LifecycleState = {
      lastCapture: makeEvent({ timestamp: '2026-03-28T10:00:00Z' }),
      lastPreview: makeEvent({ timestamp: '2026-03-28T14:00:00Z' }),
      lastApply: makeEvent({ timestamp: '2026-03-28T12:00:00Z' }),
      lastVerify: makeEvent({ timestamp: '2026-03-28T08:00:00Z' }),
    };
    const result = buildRecentActivity(state);
    expect(result).toHaveLength(3);
    // Verify the oldest one (verify at 08:00) was excluded
    expect(result.find(a => a!.type === 'verify')).toBeUndefined();
  });
});
