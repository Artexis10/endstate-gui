/**
 * Tauri Bridge - Safe wrapper for Tauri APIs with web fallbacks
 * 
 * ONLY this file may import @tauri-apps/api/*
 * All other code must use this bridge to avoid web-only boot crashes.
 * 
 * Strategy:
 * 1. If window.__TAURI__ mock exists (tests), use it exclusively
 * 2. Otherwise, try real @tauri-apps/api/* imports
 * 3. If real Tauri fails, fall back to web-safe defaults for allowlisted commands
 */

// Commands that have safe web fallbacks (used in web-only E2E tests)
const WEB_FALLBACK_COMMANDS: Record<string, () => any> = {
  'ensure_dir': () => null,
  'check_file_exists': () => null,
  'read_dir': () => [],
  'list_manifest_files': () => [],
  'get_default_profiles_directory': () => 'C:\\test\\profiles',
  'show_file_dialog': () => null,
  'run_autosuite_streaming': () => null,
};

function hasMock(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  // Mock-first: if test mock exists, use it exclusively
  if (hasMock()) {
    const mock = (window as any).__TAURI__;
    if (mock?.core?.invoke) {
      return await mock.core.invoke(cmd, args);
    }
  }
  
  // Try real Tauri API
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err) {
    // Real Tauri not available - use web fallback if command is allowlisted
    if (cmd in WEB_FALLBACK_COMMANDS) {
      return WEB_FALLBACK_COMMANDS[cmd]() as T;
    }
    // For non-allowlisted commands, re-throw to signal failure
    throw err;
  }
}

export async function safeListen<T = any>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> {
  // Mock-first: if test mock exists, use it exclusively
  if (hasMock()) {
    const mock = (window as any).__TAURI__;
    if (mock?.event?.listen) {
      return await mock.event.listen(event, handler);
    }
  }
  
  // Try real Tauri API
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<T>(event, handler);
  } catch {
    // Real Tauri not available - return no-op unlisten
    return () => {};
  }
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
