/**
 * Tauri Bridge - Safe wrapper for Tauri APIs with web fallbacks
 * 
 * ONLY this file may import @tauri-apps/api/*
 * All other code must use this bridge to avoid web-only boot crashes.
 * 
 * Strategy:
 * 1. If test mock exists (window.__TAURI__.core.invoke is a function), use it exclusively
 * 2. Otherwise, if in Tauri runtime, use real @tauri-apps/api/* - errors are fatal
 * 3. Only use web fallbacks when NOT in Tauri runtime (pure web browser)
 */

// Commands that have safe web fallbacks (used in web-only E2E tests)
const WEB_FALLBACK_COMMANDS: Record<string, () => any> = {
  'ensure_dir': () => null,
  'check_file_exists': () => null,
  'read_dir': () => [],
  'list_manifest_files': () => [],
  'get_default_profiles_directory': () => 'C:\\test\\profiles',
  'show_file_dialog': () => null,
  'run_endstate_streaming': () => null,
};

/**
 * Check if a test mock is installed (Playwright addInitScript sets window.__TAURI__.core.invoke)
 */
function hasTestMock(): boolean {
  if (typeof window === 'undefined') return false;
  const mock = (window as any).__TAURI__;
  // Test mocks explicitly set core.invoke as a function
  return mock?.core?.invoke && typeof mock.core.invoke === 'function';
}

/**
 * Detect if we're running in real Tauri runtime (not pure web browser).
 * Uses multiple heuristics in order of reliability.
 */
export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  
  // 1. Most reliable: Vite/Tauri sets this env var during dev and build
  if (import.meta.env.TAURI_PLATFORM) return true;
  
  // 2. Check for Tauri internals (Tauri v2)
  if ('__TAURI_INTERNALS__' in window) return true;
  
  // 3. Check for Tauri IPC (Tauri v1/v2)
  if ('__TAURI_IPC__' in window) return true;
  
  // 4. Check for window.__TAURI__ (real Tauri, not test mock)
  // Real Tauri sets __TAURI__ but test mocks also set it, so check for internals
  const tauriObj = (window as any).__TAURI__;
  if (tauriObj && !hasTestMock()) {
    // Has __TAURI__ but not our test mock structure - likely real Tauri
    return true;
  }
  
  // 5. Weak fallback: user agent
  if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Tauri')) return true;
  
  return false;
}

export async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  // Mock-first: if test mock exists, use it exclusively
  if (hasTestMock()) {
    return await (window as any).__TAURI__.core.invoke(cmd, args);
  }
  
  const inTauri = isTauriRuntime();
  
  // Try real Tauri API
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err) {
    // In real Tauri runtime, errors are fatal - don't silently fall back
    if (inTauri) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Tauri invoke failed for '${cmd}': ${msg}`);
    }
    // Not in Tauri runtime - use web fallback if command is allowlisted
    if (cmd in WEB_FALLBACK_COMMANDS) {
      return WEB_FALLBACK_COMMANDS[cmd]() as T;
    }
    throw err;
  }
}

export async function safeListen<T = any>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<() => void> {
  // Mock-first: if test mock exists, use it exclusively
  if (hasTestMock()) {
    const mock = (window as any).__TAURI__;
    if (mock?.event?.listen) {
      return await mock.event.listen(event, handler);
    }
    // Mock exists but no event.listen - return no-op for tests
    return () => {};
  }
  
  const inTauri = isTauriRuntime();
  
  // Try real Tauri API (listen is from @tauri-apps/api/event, NOT core)
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<T>(event, handler);
  } catch (err) {
    // In real Tauri runtime, errors are fatal
    if (inTauri) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Tauri listen failed for '${event}': ${msg}`);
    }
    // Not in Tauri runtime - return no-op unlisten
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

export async function openFolder(path: string): Promise<{ ok: boolean; reason?: string; path?: string }> {
  const inTauri = isTauriRuntime();
  
  // In web mode, return failure immediately (no Tauri bridge available)
  if (!inTauri) {
    return { ok: false, reason: 'web', path };
  }
  
  // In Tauri mode, try to invoke the command
  try {
    await safeInvoke('open_folder', { path });
    return { ok: true };
  } catch (err) {
    console.error('Failed to open folder:', err);
    throw err;
  }
}

export const invoke = safeInvoke;
export const listen = safeListen;
