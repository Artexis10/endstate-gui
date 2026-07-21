/**
 * Tauri Bridge - Safe wrapper for Tauri APIs with web fallbacks
 *
 * ONLY this file may import @tauri-apps/api/*
 * All other code must use this bridge to avoid web-only boot crashes.
 *
 * Strategy:
 * 1. If test mock exists (window.__TAURI__.core.invoke is a function), use it exclusively
 * 2. If browser-bridge mode is enabled (VITE_BROWSER_BRIDGE=1) and we're in a
 *    web browser, route invoke/listen through the dev-only HTTP server in the
 *    Tauri backend (port 9876). This lets us drive the GUI from a regular
 *    Chrome tab during development.
 * 3. Otherwise, if in Tauri runtime, use real @tauri-apps/api/* - errors are fatal
 * 4. Only use web fallbacks when NOT in Tauri runtime (pure web browser)
 */

import { httpInvoke, httpListen } from './http-bridge';

// Commands that have safe web fallbacks (used in web-only E2E tests)
const WEB_FALLBACK_COMMANDS: Record<string, () => any> = {
  'ensure_dir': () => null,
  'check_file_exists': () => null,
  'read_dir': () => [],
  'list_manifest_files': () => [],
  'get_default_profiles_directory': () => 'C:\\test\\profiles',
  'get_capture_cache_directory': () => 'C:\\test\\cache\\captures',
  'show_file_dialog': () => null,
  'run_endstate_streaming': () => null,
  'delete_file_silent': () => null,
  'copy_file': () => null,
  'read_file_base64': () => '',
  'cleanup_capture_cache': () => null,
  // NOTE: profile-import commands intentionally have NO silent web fallback.
  // Returning '' here reads downstream as a successful import (a silent no-op)
  // when no engine backend is present. Fail loudly instead so the UI surfaces a
  // friendly error (see #187). Real imports run in Tauri or via the dev bridge.
  'extract_zip_profile': () => {
    throw new Error('Profile import requires the Endstate desktop app.');
  },
  'import_zip_from_base64': () => {
    throw new Error('Profile import requires the Endstate desktop app.');
  },
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

/**
 * Check if we're in browser-bridge mode — a regular Chrome tab pointed at the
 * Vite dev server, with a sibling Tauri process exposing the engine via the
 * dev-only HTTP bridge on port 9876.
 */
export function isBrowserBridgeMode(): boolean {
  if (typeof window === 'undefined') return false;
  return !isTauriRuntime() && import.meta.env.VITE_BROWSER_BRIDGE === '1';
}

/**
 * Check if an engine backend is available (Tauri runtime OR browser bridge).
 * Use this instead of isTauriRuntime() when guarding engine functionality
 * that should also work from a browser tab during development.
 */
export function isEngineAvailable(): boolean {
  return isTauriRuntime() || isBrowserBridgeMode();
}

export async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  // Mock-first: if test mock exists, use it exclusively
  if (hasTestMock()) {
    return await (window as any).__TAURI__.core.invoke(cmd, args);
  }

  // Browser-bridge mode: route invoke through the dev HTTP server
  if (isBrowserBridgeMode()) {
    return httpInvoke<T>(cmd, args);
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
    return () => {};
  }

  // Browser-bridge mode: route listen through SSE
  if (isBrowserBridgeMode()) {
    return httpListen<T>(event, handler);
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
  if (!isEngineAvailable()) {
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
