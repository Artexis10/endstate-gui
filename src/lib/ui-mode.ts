/**
 * Global UI Mode State for Endstate GUI
 * 
 * Controls the presentation layer between:
 * - "default": Simplified view for non-technical users (sidebar hidden)
 * - "advanced": Full navigation for power users (sidebar visible)
 * 
 * Persisted to localStorage so preference survives app restarts.
 * This is a PRESENTATION change only - no behavioral differences.
 */

import { getItem, setItem } from './storage';

export type UIMode = 'default' | 'advanced';

const STORAGE_KEY = 'endstate-ui-mode';

const DEFAULT_MODE: UIMode = 'default';

/**
 * Load UI mode from localStorage
 */
export function loadUIMode(): UIMode {
  try {
    const stored = getItem(STORAGE_KEY);
    if (stored === 'default' || stored === 'advanced') {
      return stored;
    }
  } catch (err) {
    console.warn('Failed to load UI mode:', err);
  }
  return DEFAULT_MODE;
}

/**
 * Save UI mode to localStorage
 */
export function saveUIMode(mode: UIMode): void {
  try {
    setItem(STORAGE_KEY, mode);
  } catch (err) {
    console.warn('Failed to save UI mode:', err);
  }
}

/**
 * Toggle between default and advanced modes
 */
export function toggleUIMode(currentMode: UIMode): UIMode {
  return currentMode === 'default' ? 'advanced' : 'default';
}
