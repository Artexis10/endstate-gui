/**
 * Tauri Bridge - Safe wrapper for Tauri APIs with web fallbacks
 * 
 * Provides web-safe no-op fallbacks for Tauri functionality needed by Capture/Apply flows.
 * Detects Tauri presence safely without crashing in web-only environments.
 */

let tauriCore: any = null;
let tauriAvailable = false;

/**
 * Safely detect and initialize Tauri
 */
async function initTauri() {
  if (tauriCore !== null) return tauriAvailable;
  
  try {
    // Check if we're in a browser environment first
    if (typeof window === 'undefined') {
      tauriAvailable = false;
      return false;
    }
    
    // Dynamic import that won't crash in web environment
    const module = await import('@tauri-apps/api/core');
    
    // Check if invoke function actually exists (not a stub in web build)
    if (module && typeof module.invoke === 'function') {
      tauriCore = module;
      tauriAvailable = true;
    } else {
      tauriAvailable = false;
    }
  } catch {
    // Tauri not available (web environment)
    tauriAvailable = false;
  }
  
  return tauriAvailable;
}

/**
 * Check if running in Tauri environment
 */
export async function isTauriAvailable(): Promise<boolean> {
  return await initTauri();
}

/**
 * Invoke a Tauri command with web fallback
 */
export async function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  const available = await initTauri();
  
  if (available && tauriCore) {
    return await tauriCore.invoke<T>(cmd, args);
  }
  
  // Web fallback - check for mock
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    return await (window as any).__TAURI__.core.invoke(cmd, args);
  }
  
  // No-op fallback for web
  if (cmd === 'ensure_dir') return null as T;
  if (cmd === 'read_dir') return [] as T;
  if (cmd === 'get_default_profiles_directory') return 'C:\\test\\profiles' as T;
  
  return null as T;
}

/**
 * Get profiles directory with web fallback
 */
export async function getProfilesDirectory(customDir?: string): Promise<string> {
  if (customDir) return customDir;
  
  try {
    const dir = await invoke<string>('get_default_profiles_directory');
    return dir || 'C:\\test\\profiles';
  } catch {
    return 'C:\\test\\profiles';
  }
}

/**
 * Ensure directory exists with web fallback
 */
export async function ensureDirectory(path: string): Promise<void> {
  try {
    await invoke('ensure_dir', { path });
  } catch {
    // No-op in web environment
  }
}


