import { useSyncExternalStore } from 'react';
import { loadSettings } from '../settings';

/**
 * Hook to read the global "show details" setting.
 * Returns true if details UI should be shown, false otherwise.
 * 
 * This is the single source of truth for whether Details disclosures
 * should be rendered throughout the app.
 */
export function useShowDetails(): boolean {
  // Use useSyncExternalStore for reliable sync with localStorage
  const showDetails = useSyncExternalStore(
    subscribeToSettings,
    getShowDetailsSnapshot,
    getShowDetailsSnapshot // Server snapshot (same as client for this use case)
  );

  return showDetails;
}

// Subscribe to storage events
function subscribeToSettings(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  
  // Also poll for changes since in-app updates don't trigger storage events
  const interval = setInterval(callback, 500);
  
  return () => {
    window.removeEventListener('storage', callback);
    clearInterval(interval);
  };
}

// Get current snapshot of the setting
function getShowDetailsSnapshot(): boolean {
  const settings = loadSettings();
  return settings.showTechnicalDetails;
}
