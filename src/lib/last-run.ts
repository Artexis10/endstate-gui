/**
 * Last Run tracking with localStorage persistence
 */

import { getItem, setItem } from './storage';

export interface LastRunData {
  timestamp: string;
  command: 'capture' | 'apply' | 'verify';
  profile?: string;
  outcome: {
    succeeded?: number;
    skipped?: number;
    failed?: number;
    missing?: number;
    ok?: number;
    mismatch?: number;
  };
}

const STORAGE_KEY = 'autosuite-last-run';

export function saveLastRun(data: LastRunData): void {
  try {
    setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save last run:', err);
  }
}

export function loadLastRun(): LastRunData | null {
  try {
    const stored = getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.warn('Failed to load last run:', err);
    return null;
  }
}
