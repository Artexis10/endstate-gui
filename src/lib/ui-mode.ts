/**
 * Sidebar Visibility Preference for Endstate GUI
 * 
 * Controls whether the navigation sidebar is shown or hidden.
 * This is purely a layout preference - no behavioral differences.
 * 
 * The app uses progressive disclosure within each section rather than
 * a global "advanced mode" toggle. Power users access details via
 * per-section "Show activity", "Details", or "View logs" expansions.
 * 
 * Persisted to localStorage so preference survives app restarts.
 */

import { getItem, setItem } from './storage';

const STORAGE_KEY = 'endstate-sidebar-visible';

/**
 * Load sidebar visibility preference from localStorage
 */
export function loadSidebarVisible(): boolean {
  try {
    const stored = getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch (err) {
    console.warn('Failed to load sidebar preference:', err);
  }
  return false; // Default: sidebar hidden for clean, focused UI
}

/**
 * Save sidebar visibility preference to localStorage
 */
export function saveSidebarVisible(visible: boolean): void {
  try {
    setItem(STORAGE_KEY, visible ? 'true' : 'false');
  } catch (err) {
    console.warn('Failed to save sidebar preference:', err);
  }
}
