import type { AppEvent } from '@/lib/apply-utils';

/**
 * Whether an event describes a config-only synthesized app rather than a real
 * package install.
 *
 * The engine synthesizes an "app" for settings it can restore but cannot
 * install (driver `manual`). Those belong to the "Settings only" section and
 * must never move an app counter — counting them is what produced a results
 * screen reading "94 apps" beside "102 present".
 *
 * This lived as a private helper inside setup-flow while the live progress
 * counters in App.tsx counted every event with no equivalent filter, so the
 * in-progress total ran ahead of the final one (97 during a run that ended at
 * 91 apps). One definition, imported by both, is the point.
 */
export function isConfigOnlyApp(event: AppEvent): boolean {
  return event.driver === 'manual';
}
