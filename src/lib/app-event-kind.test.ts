import { describe, it, expect } from 'vitest';
import type { AppEvent } from '@/lib/apply-utils';
import { isConfigOnlyApp } from './app-event-kind';

function event(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    app: 'Some.App',
    action: 'OK',
    statusKey: 'present',
    timestamp: 1,
    ...overrides,
  } as AppEvent;
}

describe('isConfigOnlyApp', () => {
  it('identifies config-only synthesized apps by the manual driver', () => {
    expect(isConfigOnlyApp(event({ driver: 'manual' }))).toBe(true);
  });

  it('does not claim real package installs', () => {
    expect(isConfigOnlyApp(event({ driver: 'winget' }))).toBe(false);
    expect(isConfigOnlyApp(event({ driver: 'chocolatey' }))).toBe(false);
    expect(isConfigOnlyApp(event())).toBe(false);
  });

  // This predicate lived privately inside setup-flow while App.tsx's live
  // progress counters had no equivalent filter, so the in-progress total ran
  // ahead of the final one — "97 already present" during a run that ended
  // reporting 91 apps. Both surfaces import this now; keeping one definition is
  // the point of the module.
  it('is the single definition both counting surfaces rely on', () => {
    const settingsRow = event({ driver: 'manual', statusKey: 'skipped' });
    const appRow = event({ driver: 'winget', statusKey: 'present' });

    const countable = [settingsRow, appRow].filter((e) => !isConfigOnlyApp(e));

    expect(countable).toEqual([appRow]);
  });
});
