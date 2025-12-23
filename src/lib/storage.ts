/**
 * Namespaced localStorage wrapper to isolate test and Tauri runtime storage.
 * 
 * Namespace selection priority:
 * 1. VITE_STORAGE_NS env var (set to "test" for Playwright tests)
 * 2. "tauri" if running in Tauri runtime (detected via import.meta.env.TAURI_PLATFORM)
 * 3. "web" for plain browser
 * 
 * IMPORTANT: Tauri runtime does NOT migrate from legacy keys to prevent
 * web/test settings from poisoning the Tauri app.
 */

import { isTauriRuntime } from './tauri-bridge';

/**
 * All known namespaces used by the app
 */
export const ALL_NAMESPACES = ['tauri', 'web', 'test'] as const;

/**
 * Get the storage namespace based on environment
 */
function getNamespace(): string {
  // 1. Check for explicit env var (used by tests)
  const envNs = import.meta.env.VITE_STORAGE_NS;
  if (envNs) return envNs;
  
  // 2. Check for Tauri runtime (uses robust detection from tauri-bridge)
  if (isTauriRuntime()) return 'tauri';
  
  // 3. Default to web
  return 'web';
}

/**
 * Get the namespaced key
 */
function getNamespacedKey(key: string): string {
  const ns = getNamespace();
  return `${ns}:${key}`;
}

/**
 * Known storage keys for migration and cleanup
 */
export const KNOWN_KEYS = [
  'autosuite-gui-settings',
  'autosuite-last-run',
  'autosuite-show-technical-logs',
] as const;

/**
 * Get an item from localStorage with namespace support.
 * 
 * Migration behavior:
 * - Tauri: NEVER reads from legacy keys (prevents web/test pollution)
 * - Web/Test: Falls back to legacy keys and migrates them
 */
export function getItem(key: string): string | null {
  const ns = getNamespace();
  const nsKey = `${ns}:${key}`;
  
  // Try namespaced key first
  const nsValue = localStorage.getItem(nsKey);
  if (nsValue !== null) {
    return nsValue;
  }
  
  // Tauri runtime: DO NOT read from legacy keys to prevent pollution
  if (ns === 'tauri') {
    return null;
  }
  
  // Web/Test: Fall back to legacy un-namespaced key and migrate
  const legacyValue = localStorage.getItem(key);
  if (legacyValue !== null) {
    // Migrate to namespaced key
    localStorage.setItem(nsKey, legacyValue);
    localStorage.removeItem(key);
    return legacyValue;
  }
  
  return null;
}

/**
 * Set an item in localStorage with namespace prefix
 */
export function setItem(key: string, value: string): void {
  const nsKey = getNamespacedKey(key);
  localStorage.setItem(nsKey, value);
}

/**
 * Remove an item from localStorage (both namespaced and legacy)
 */
export function removeItem(key: string): void {
  const nsKey = getNamespacedKey(key);
  localStorage.removeItem(nsKey);
  // Also remove legacy key if it exists
  localStorage.removeItem(key);
}

/**
 * Clear ALL known keys across ALL namespaces for complete reset.
 * This ensures the app can recover from any stuck state.
 */
export function clearAllKnownKeys(): void {
  for (const key of KNOWN_KEYS) {
    // Remove legacy un-namespaced version
    localStorage.removeItem(key);
    
    // Remove ALL namespaced versions
    for (const ns of ALL_NAMESPACES) {
      localStorage.removeItem(`${ns}:${key}`);
    }
  }
}

/**
 * Get current namespace (for debugging/display)
 */
export function getCurrentNamespace(): string {
  return getNamespace();
}
