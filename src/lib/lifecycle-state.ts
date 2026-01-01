/**
 * Global Lifecycle State for the Endstate GUI
 * 
 * Tracks timestamps and outcomes of key app actions to:
 * - Avoid redundant operations (e.g., re-scanning when just scanned)
 * - Provide coherent state across page navigation
 * - Enable smart UX decisions based on recent activity
 * 
 * Persisted to localStorage so state survives app restarts.
 */

import { getItem, setItem } from './storage';

export type LifecycleEventType = 'capture' | 'preview' | 'apply' | 'verify';

export interface LifecycleEvent {
  timestamp: string;
  profile?: string;
  profilePath?: string;
  success: boolean;
  summary?: {
    total?: number;
    installed?: number;
    alreadyPresent?: number;
    failed?: number;
    missing?: number;
  };
  /** Artifact paths from the run bundle (for Reports log visibility) */
  artifactPaths?: {
    logFile?: string;
    eventsFile?: string;
    bundleDir?: string;
  };
}

export interface LifecycleState {
  lastCapture: LifecycleEvent | null;
  lastPreview: LifecycleEvent | null;
  lastApply: LifecycleEvent | null;
  lastVerify: LifecycleEvent | null;
}

const STORAGE_KEY = 'endstate-lifecycle-state';

const DEFAULT_STATE: LifecycleState = {
  lastCapture: null,
  lastPreview: null,
  lastApply: null,
  lastVerify: null,
};

/**
 * Load lifecycle state from localStorage
 */
export function loadLifecycleState(): LifecycleState {
  try {
    const stored = getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load lifecycle state:', err);
  }
  return DEFAULT_STATE;
}

/**
 * Save lifecycle state to localStorage
 */
export function saveLifecycleState(state: LifecycleState): void {
  try {
    setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save lifecycle state:', err);
  }
}

/**
 * Record a lifecycle event
 */
export function recordLifecycleEvent(
  eventType: LifecycleEventType,
  event: LifecycleEvent
): LifecycleState {
  const current = loadLifecycleState();
  const updated: LifecycleState = { ...current };
  
  switch (eventType) {
    case 'capture':
      updated.lastCapture = event;
      break;
    case 'preview':
      updated.lastPreview = event;
      break;
    case 'apply':
      updated.lastApply = event;
      // Clear preview after successful apply (it's now stale)
      if (event.success) {
        updated.lastPreview = null;
      }
      break;
    case 'verify':
      updated.lastVerify = event;
      break;
  }
  
  saveLifecycleState(updated);
  return updated;
}

/**
 * Check if a recent scan exists for the given profile
 * "Recent" = within the last 5 minutes
 */
export function hasRecentScan(
  state: LifecycleState,
  profilePath: string,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  const lastPreview = state.lastPreview;
  const lastVerify = state.lastVerify;
  
  // Check preview first (more recent data)
  if (lastPreview && lastPreview.profilePath === profilePath) {
    const age = Date.now() - new Date(lastPreview.timestamp).getTime();
    if (age < maxAgeMs) return true;
  }
  
  // Check verify
  if (lastVerify && lastVerify.profilePath === profilePath) {
    const age = Date.now() - new Date(lastVerify.timestamp).getTime();
    if (age < maxAgeMs) return true;
  }
  
  return false;
}

/**
 * Get the most recent scan for a profile (preview or verify)
 */
export function getMostRecentScan(
  state: LifecycleState,
  profilePath: string
): LifecycleEvent | null {
  const preview = state.lastPreview;
  const verify = state.lastVerify;
  
  // Filter to matching profile
  const matchingPreview = preview?.profilePath === profilePath ? preview : null;
  const matchingVerify = verify?.profilePath === profilePath ? verify : null;
  
  if (!matchingPreview && !matchingVerify) return null;
  if (!matchingPreview) return matchingVerify;
  if (!matchingVerify) return matchingPreview;
  
  // Return the more recent one
  const previewTime = new Date(matchingPreview.timestamp).getTime();
  const verifyTime = new Date(matchingVerify.timestamp).getTime();
  return previewTime > verifyTime ? matchingPreview : matchingVerify;
}

/**
 * Clear lifecycle state (for testing or reset)
 */
export function clearLifecycleState(): void {
  saveLifecycleState(DEFAULT_STATE);
}

/**
 * Format a timestamp for display (relative time)
 */
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
