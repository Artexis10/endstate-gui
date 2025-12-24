/**
 * Last Run tracking with localStorage persistence
 * 
 * Per-workflow storage: each command (capture, apply, verify) has its own last run.
 * This prevents confusion where "Last run: Capture" appears on the Apply page.
 */

import { getItem, setItem } from './storage';

export type LastRunCommand = 'capture' | 'apply' | 'verify';

export interface LastRunData {
  timestamp: string;
  command: LastRunCommand;
  profile?: string;
  outcome: {
    // Capture outcomes
    succeeded?: number;
    skipped?: number;
    failed?: number;
    // Apply outcomes
    installed?: number;
    alreadyPresent?: number;
    needsAttention?: number;
    // Verify outcomes
    missing?: number;
    ok?: number;
    mismatch?: number;
  };
}

// Storage keys per command
const STORAGE_KEYS: Record<LastRunCommand, string> = {
  capture: 'endstate-last-run-capture',
  apply: 'endstate-last-run-apply',
  verify: 'endstate-last-run-verify',
};

// Legacy key for migration
const LEGACY_STORAGE_KEY = 'endstate-last-run';

/**
 * Save last run data for a specific command
 */
export function saveLastRun(data: LastRunData): void {
  try {
    const key = STORAGE_KEYS[data.command];
    setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save last run:', err);
  }
}

/**
 * Load last run data for a specific command
 */
export function loadLastRunForCommand(command: LastRunCommand): LastRunData | null {
  try {
    const key = STORAGE_KEYS[command];
    const stored = getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.warn('Failed to load last run:', err);
    return null;
  }
}

/**
 * Load all last runs (for migration or debugging)
 */
export function loadAllLastRuns(): Record<LastRunCommand, LastRunData | null> {
  return {
    capture: loadLastRunForCommand('capture'),
    apply: loadLastRunForCommand('apply'),
    verify: loadLastRunForCommand('verify'),
  };
}

/**
 * Migrate legacy single last-run to per-command storage
 * Call this once on app startup
 */
export function migrateLegacyLastRun(): void {
  try {
    const legacyStored = getItem(LEGACY_STORAGE_KEY);
    if (!legacyStored) return;
    
    const legacyData: LastRunData = JSON.parse(legacyStored);
    if (legacyData && legacyData.command) {
      // Save to the appropriate per-command key
      saveLastRun(legacyData);
      // Remove legacy key (optional - keep for safety)
      // removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to migrate legacy last run:', err);
  }
}

/**
 * @deprecated Use loadLastRunForCommand instead
 * Kept for backward compatibility during migration
 */
export function loadLastRun(): LastRunData | null {
  // Try to load from legacy key first for migration
  try {
    const stored = getItem(LEGACY_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (err) {
    // Ignore
  }
  return null;
}
