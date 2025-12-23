/**
 * Tauri Bridge - Safe wrapper for Tauri APIs with web fallbacks
 * 
 * ONLY this file may import @tauri-apps/api/*
 * All other code must use this bridge to avoid web-only boot crashes.
 */

let tauriCore: any = null;
let tauriEvent: any = null;
let initialized = false;

function isRealTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function hasMock(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

async function initTauri() {
  if (initialized) return;
  initialized = true;
  
  if (hasMock() || !isRealTauri()) {
    return;
  }
  
  try {
    const coreModule = await import('@tauri-apps/api/core');
    const eventModule = await import('@tauri-apps/api/event');
    
    if (coreModule?.invoke && eventModule?.listen) {
      tauriCore = coreModule;
      tauriEvent = eventModule;
    }
  } catch {
    // Tauri not available
  }
}

export async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (hasMock()) {
    return await (window as any).__TAURI__.core.invoke(cmd, args);
  }
  
  await initTauri();
  if (tauriCore?.invoke) {
    return await tauriCore.invoke<T>(cmd, args);
  }
  
  switch (cmd) {
    case 'ensure_dir':
    case 'check_file_exists':
      return null as T;
    case 'read_dir':
      return [] as T;
    case 'get_default_profiles_directory':
      return 'C:\\test\\profiles' as T;
    case 'show_file_dialog':
      return null as T;
    default:
      return null as T;
  }
}

export async function safeListen<T = any>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> {
  if (hasMock() && (window as any).__TAURI__.event?.listen) {
    return await (window as any).__TAURI__.event.listen(event, handler);
  }
  
  await initTauri();
  if (tauriEvent?.listen) {
    return await tauriEvent.listen<T>(event, handler);
  }
  
  return () => {};
}

export async function getProfilesDirectory(customDir?: string): Promise<string> {
  if (customDir) return customDir;
  
  try {
    const dir = await safeInvoke<string>('get_default_profiles_directory');
    return dir || 'C:\\test\\profiles';
  } catch {
    return 'C:\\test\\profiles';
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  try {
    await safeInvoke('ensure_dir', { path });
  } catch {
    // No-op in web environment
  }
}

export const invoke = safeInvoke;
export const listen = safeListen;
