/**
 * Selectors and utility functions for the Overview Screen
 */

import type { LifecycleState, LifecycleEvent } from '@/lib/lifecycle-state';
import type { ActionType } from './types';

/**
 * Get last event for an action type
 */
export function getLastEvent(lifecycleState: LifecycleState, action: ActionType): LifecycleEvent | null {
  switch (action) {
    case 'capture':
      return lifecycleState.lastCapture;
    case 'setup':
      return lifecycleState.lastApply || lifecycleState.lastPreview;
    case 'check':
      return lifecycleState.lastVerify || lifecycleState.lastPreview;
    default:
      return null;
  }
}

/**
 * Format last event summary
 */
export function formatLastEventSummary(lifecycleState: LifecycleState, action: ActionType): string | null {
  const event = getLastEvent(lifecycleState, action);
  if (!event) return null;
  
  switch (action) {
    case 'capture':
      return event.summary?.total ? `${event.summary.total} apps captured` : null;
    case 'setup':
      if (event.summary?.installed !== undefined) {
        return `${event.summary.installed} installed, ${event.summary.alreadyPresent || 0} already present`;
      }
      return null;
    case 'check':
      if (event.summary?.missing !== undefined && event.summary.missing > 0) {
        return `${event.summary.missing} missing`;
      }
      if (event.summary?.alreadyPresent !== undefined) {
        return `${event.summary.alreadyPresent} present`;
      }
      return null;
    default:
      return null;
  }
}

/**
 * Build recent activity list from lifecycle state
 */
export function buildRecentActivity(lifecycleState: LifecycleState) {
  return [
    lifecycleState.lastCapture && {
      type: 'capture' as const,
      label: 'Saved computer',
      timestamp: lifecycleState.lastCapture.timestamp,
      success: lifecycleState.lastCapture.success,
      summary: lifecycleState.lastCapture.summary?.total 
        ? `${lifecycleState.lastCapture.summary.total} apps`
        : undefined,
    },
    lifecycleState.lastPreview && {
      type: 'preview' as const,
      label: 'Previewed setup',
      timestamp: lifecycleState.lastPreview.timestamp,
      success: lifecycleState.lastPreview.success,
      profile: lifecycleState.lastPreview.profile,
      summary: lifecycleState.lastPreview.summary?.installed !== undefined
        ? `${lifecycleState.lastPreview.summary.installed} to install`
        : undefined,
    },
    lifecycleState.lastApply && {
      type: 'apply' as const,
      label: 'Applied setup',
      timestamp: lifecycleState.lastApply.timestamp,
      success: lifecycleState.lastApply.success,
      profile: lifecycleState.lastApply.profile,
      summary: lifecycleState.lastApply.summary?.installed !== undefined
        ? `${lifecycleState.lastApply.summary.installed} installed`
        : undefined,
    },
    lifecycleState.lastVerify && {
      type: 'verify' as const,
      label: 'Checked computer',
      timestamp: lifecycleState.lastVerify.timestamp,
      success: lifecycleState.lastVerify.success,
      profile: lifecycleState.lastVerify.profile,
      summary: lifecycleState.lastVerify.summary?.missing !== undefined && lifecycleState.lastVerify.summary.missing > 0
        ? `${lifecycleState.lastVerify.summary.missing} missing`
        : lifecycleState.lastVerify.summary?.alreadyPresent !== undefined
          ? `${lifecycleState.lastVerify.summary.alreadyPresent} present`
          : undefined,
    },
  ].filter(Boolean).sort((a, b) => 
    new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime()
  ).slice(0, 3);
}
