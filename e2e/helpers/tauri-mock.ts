import { Page, BrowserContext } from '@playwright/test';

export interface TauriMockOptions {
  invoke?: {
    [command: string]: any;
  };
  enableEventListeners?: boolean;
  allowUnknownInvokes?: boolean;
  /** Initial set of profile file paths for list_manifest_files */
  initialProfileFiles?: string[];
}

export async function installTauriMock(page: Page, options: TauriMockOptions = {}) {
  const customHandlers = options.invoke || {};
  const enableEventListeners = options.enableEventListeners || false;
  const allowUnknownInvokes = options.allowUnknownInvokes || false;
  const initialProfileFiles = options.initialProfileFiles || [];

  // Enable E2E mode flag so app installs E2E hooks even when reusing dev server
  await page.addInitScript(() => {
    (window as any).__ENDSTATE_E2E_MODE__ = true;
  });

  await page.addInitScript(
    ({ customHandlers, enableEventListeners, allowUnknownInvokes, initialProfileFiles }) => {
      // Initialize test trackers for file operations
      // These MUST be initialized before any invoke handlers run
      (window as any).__test_operations = (window as any).__test_operations || [];
      (window as any).__test_profileFiles = (window as any).__test_profileFiles || new Set<string>(initialProfileFiles);
      (window as any).__test_renameFileCalls = (window as any).__test_renameFileCalls || [];
      (window as any).__test_deleteFileCalls = (window as any).__test_deleteFileCalls || [];
      (window as any).__test_writeFileCalls = (window as any).__test_writeFileCalls || [];
      (window as any).__test_fileContents = (window as any).__test_fileContents || new Map<string, string>();

      // In-memory plugin-store implementation
      const pluginStoreData = new Map<string, any>();

      // Support multiple listeners per event topic
      const eventListeners: Map<string, Set<Function>> = new Map();

      const defaultHandlers: { [key: string]: (args?: any) => any } = {
        ensure_dir: () => null,
        read_dir: () => [],
        list_manifest_files: () => {
          const profileFiles = (window as any).__test_profileFiles;
          return Array.from(profileFiles);
        },
        get_default_profiles_directory: () => 'C:\\test\\profiles',
        get_capture_cache_directory: () => 'C:\\test\\cache',
        read_text_file: (args?: any) => {
          const fileContents = (window as any).__test_fileContents;
          const path = args?.path;
          if (fileContents.has(path)) {
            return fileContents.get(path);
          }
          return '{"version": 1, "apps": []}';
        },
        check_file_exists: (args?: any) => {
          const profileFiles = (window as any).__test_profileFiles;
          return profileFiles.has(args?.path);
        },
        validate_profile: () => ({ valid: true, summary: { name: 'test', version: 1, appCount: 0 } }),
        delete_file: (args?: any) => {
          const operations = (window as any).__test_operations;
          const deleteFileCalls = (window as any).__test_deleteFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const path = args?.path;
          operations.push({ type: 'delete_file', path });
          deleteFileCalls.push(path);
          profileFiles.delete(path);
          return null;
        },
        delete_file_silent: (args?: any) => {
          const operations = (window as any).__test_operations;
          const deleteFileCalls = (window as any).__test_deleteFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const path = args?.path;
          operations.push({ type: 'delete_file_silent', path });
          deleteFileCalls.push(path);
          profileFiles.delete(path);
          return null;
        },
        rename_file: (args?: any) => {
          const operations = (window as any).__test_operations;
          const renameFileCalls = (window as any).__test_renameFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const oldPath = args?.oldPath;
          const newPath = args?.newPath;
          operations.push({ type: 'rename_file', oldPath, newPath });
          renameFileCalls.push({ oldPath, newPath });
          profileFiles.delete(oldPath);
          profileFiles.add(newPath);
          return null;
        },
        write_text_file: (args?: any) => {
          const operations = (window as any).__test_operations;
          const writeFileCalls = (window as any).__test_writeFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const fileContents = (window as any).__test_fileContents;
          const path = args?.path;
          const content = args?.content;
          operations.push({ type: 'write_text_file', path, contentLength: content?.length || 0 });
          writeFileCalls.push({ path, content });
          profileFiles.add(path);
          fileContents.set(path, content);
          return null;
        },
        copy_file: () => null,
        cleanup_capture_cache: () => null,
        show_file_dialog: () => null,
        // Plugin-store commands with in-memory implementation
        'plugin:store|load': () => {
          // Return all stored data as an object
          const result: any = {};
          pluginStoreData.forEach((value, key) => {
            result[key] = value;
          });
          return result;
        },
        'plugin:store|save': () => null, // No-op for in-memory store
        'plugin:store|get': (args?: any) => {
          const key = args?.key;
          return pluginStoreData.get(key) ?? null;
        },
        'plugin:store|set': (args?: any) => {
          const { key, value } = args || {};
          if (key !== undefined) {
            pluginStoreData.set(key, value);
          }
          return null;
        },
        'plugin:store|delete': (args?: any) => {
          const key = args?.key;
          if (key !== undefined) {
            pluginStoreData.delete(key);
          }
          return null;
        },
        'plugin:store|clear': () => {
          pluginStoreData.clear();
          return null;
        },
        'plugin:store|keys': () => Array.from(pluginStoreData.keys()),
        'plugin:store|values': () => Array.from(pluginStoreData.values()),
        'plugin:store|entries': () => Array.from(pluginStoreData.entries()),
        'plugin:store|length': () => pluginStoreData.size,
        'plugin:store|has': (args?: any) => {
          const key = args?.key;
          return pluginStoreData.has(key);
        },
      };

      const invokeImpl = async (cmd: string, args?: any) => {
        if (customHandlers && customHandlers[cmd] !== undefined) {
          const handler = customHandlers[cmd];
          if (typeof handler === 'function') {
            return handler(args);
          }
          return handler;
        }
        if (defaultHandlers[cmd]) {
          return defaultHandlers[cmd](args);
        }
        // Fail fast on unknown invokes unless explicitly allowed
        if (!allowUnknownInvokes) {
          throw new Error(`TAURI mock: unhandled invoke '${cmd}'`);
        }
        return null;
      };

      // Merge with existing __TAURI__ if present, don't overwrite
      const existingTauri = (window as any).__TAURI__ || {};
      const existingCore = existingTauri.core || {};
      const existingEvent = existingTauri.event || {};

      (window as any).__TAURI__ = {
        ...existingTauri,
        core: {
          ...existingCore,
          invoke: invokeImpl
        },
        // Top-level invoke alias (matches tauri-bridge contract)
        invoke: invokeImpl,
        event: enableEventListeners ? {
          ...existingEvent,
          listen: async (event: string, handler: Function) => {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set());
            }
            eventListeners.get(event)!.add(handler);
            
            // Return async unlisten function that removes only this specific handler
            return async () => {
              const handlers = eventListeners.get(event);
              if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                  eventListeners.delete(event);
                }
              }
            };
          }
        } : existingEvent,
        // Stable test-only emitter API for replay/streaming tests
        __test: {
          emit: (event: string, payload: any) => {
            const handlers = eventListeners.get(event);
            if (handlers) {
              handlers.forEach(handler => handler(payload));
            }
          }
        }
      };
    },
    { customHandlers, enableEventListeners, allowUnknownInvokes, initialProfileFiles }
  );
}

/**
 * Install Tauri mock at the browser context level.
 * This ensures __TAURI__ is available before any page scripts run,
 * including early module initialization (e.g., plugin-store).
 * Use this instead of installTauriMock(page) when you need the mock
 * to be available immediately on page load.
 */
export async function installTauriMockOnContext(context: BrowserContext, options: TauriMockOptions = {}) {
  const customHandlers = options.invoke || {};
  const enableEventListeners = options.enableEventListeners || false;
  const allowUnknownInvokes = options.allowUnknownInvokes || false;
  const initialProfileFiles = options.initialProfileFiles || [];

  // Enable E2E mode flag so app installs E2E hooks even when reusing dev server
  await context.addInitScript(() => {
    (window as any).__ENDSTATE_E2E_MODE__ = true;
  });

  await context.addInitScript(
    ({ customHandlers, enableEventListeners, allowUnknownInvokes, initialProfileFiles }) => {
      // Initialize test trackers for file operations
      // These MUST be initialized before any invoke handlers run
      (window as any).__test_operations = (window as any).__test_operations || [];
      (window as any).__test_profileFiles = (window as any).__test_profileFiles || new Set<string>(initialProfileFiles);
      (window as any).__test_renameFileCalls = (window as any).__test_renameFileCalls || [];
      (window as any).__test_deleteFileCalls = (window as any).__test_deleteFileCalls || [];
      (window as any).__test_writeFileCalls = (window as any).__test_writeFileCalls || [];
      (window as any).__test_fileContents = (window as any).__test_fileContents || new Map<string, string>();

      // In-memory plugin-store implementation
      const pluginStoreData = new Map<string, any>();

      // Support multiple listeners per event topic
      const eventListeners: Map<string, Set<Function>> = new Map();

      const defaultHandlers: { [key: string]: (args?: any) => any } = {
        ensure_dir: () => null,
        read_dir: () => [],
        list_manifest_files: () => {
          const profileFiles = (window as any).__test_profileFiles;
          return Array.from(profileFiles);
        },
        get_default_profiles_directory: () => 'C:\\test\\profiles',
        get_capture_cache_directory: () => 'C:\\test\\cache',
        read_text_file: (args?: any) => {
          const fileContents = (window as any).__test_fileContents;
          const path = args?.path;
          if (fileContents.has(path)) {
            return fileContents.get(path);
          }
          return '{"version": 1, "apps": []}';
        },
        check_file_exists: (args?: any) => {
          const profileFiles = (window as any).__test_profileFiles;
          return profileFiles.has(args?.path);
        },
        validate_profile: () => ({ valid: true, summary: { name: 'test', version: 1, appCount: 0 } }),
        delete_file: (args?: any) => {
          const operations = (window as any).__test_operations;
          const deleteFileCalls = (window as any).__test_deleteFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const path = args?.path;
          operations.push({ type: 'delete_file', path });
          deleteFileCalls.push(path);
          profileFiles.delete(path);
          return null;
        },
        delete_file_silent: (args?: any) => {
          const operations = (window as any).__test_operations;
          const deleteFileCalls = (window as any).__test_deleteFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const path = args?.path;
          operations.push({ type: 'delete_file_silent', path });
          deleteFileCalls.push(path);
          profileFiles.delete(path);
          return null;
        },
        rename_file: (args?: any) => {
          const operations = (window as any).__test_operations;
          const renameFileCalls = (window as any).__test_renameFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const oldPath = args?.oldPath;
          const newPath = args?.newPath;
          operations.push({ type: 'rename_file', oldPath, newPath });
          renameFileCalls.push({ oldPath, newPath });
          profileFiles.delete(oldPath);
          profileFiles.add(newPath);
          return null;
        },
        write_text_file: (args?: any) => {
          const operations = (window as any).__test_operations;
          const writeFileCalls = (window as any).__test_writeFileCalls;
          const profileFiles = (window as any).__test_profileFiles;
          const fileContents = (window as any).__test_fileContents;
          const path = args?.path;
          const content = args?.content;
          operations.push({ type: 'write_text_file', path, contentLength: content?.length || 0 });
          writeFileCalls.push({ path, content });
          profileFiles.add(path);
          fileContents.set(path, content);
          return null;
        },
        copy_file: () => null,
        cleanup_capture_cache: () => null,
        show_file_dialog: () => null,
        // Plugin-store commands with in-memory implementation
        'plugin:store|load': () => {
          // Return all stored data as an object
          const result: any = {};
          pluginStoreData.forEach((value, key) => {
            result[key] = value;
          });
          return result;
        },
        'plugin:store|save': () => null, // No-op for in-memory store
        'plugin:store|get': (args?: any) => {
          const key = args?.key;
          return pluginStoreData.get(key) ?? null;
        },
        'plugin:store|set': (args?: any) => {
          const { key, value } = args || {};
          if (key !== undefined) {
            pluginStoreData.set(key, value);
          }
          return null;
        },
        'plugin:store|delete': (args?: any) => {
          const key = args?.key;
          if (key !== undefined) {
            pluginStoreData.delete(key);
          }
          return null;
        },
        'plugin:store|clear': () => {
          pluginStoreData.clear();
          return null;
        },
        'plugin:store|keys': () => Array.from(pluginStoreData.keys()),
        'plugin:store|values': () => Array.from(pluginStoreData.values()),
        'plugin:store|entries': () => Array.from(pluginStoreData.entries()),
        'plugin:store|length': () => pluginStoreData.size,
        'plugin:store|has': (args?: any) => {
          const key = args?.key;
          return pluginStoreData.has(key);
        },
      };

      const invokeImpl = async (cmd: string, args?: any) => {
        if (customHandlers && customHandlers[cmd] !== undefined) {
          const handler = customHandlers[cmd];
          if (typeof handler === 'function') {
            return handler(args);
          }
          return handler;
        }
        if (defaultHandlers[cmd]) {
          return defaultHandlers[cmd](args);
        }
        // Fail fast on unknown invokes unless explicitly allowed
        if (!allowUnknownInvokes) {
          throw new Error(`TAURI mock: unhandled invoke '${cmd}'`);
        }
        return null;
      };

      // Merge with existing __TAURI__ if present, don't overwrite
      const existingTauri = (window as any).__TAURI__ || {};
      const existingCore = existingTauri.core || {};
      const existingEvent = existingTauri.event || {};

      (window as any).__TAURI__ = {
        ...existingTauri,
        core: {
          ...existingCore,
          invoke: invokeImpl
        },
        // Top-level invoke alias (matches tauri-bridge contract)
        invoke: invokeImpl,
        event: enableEventListeners ? {
          ...existingEvent,
          listen: async (event: string, handler: Function) => {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set());
            }
            eventListeners.get(event)!.add(handler);
            
            // Return async unlisten function that removes only this specific handler
            return async () => {
              const handlers = eventListeners.get(event);
              if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                  eventListeners.delete(event);
                }
              }
            };
          }
        } : existingEvent,
        // Stable test-only emitter API for replay/streaming tests
        __test: {
          emit: (event: string, payload: any) => {
            const handlers = eventListeners.get(event);
            if (handlers) {
              handlers.forEach(handler => handler(payload));
            }
          }
        }
      };
    },
    { customHandlers, enableEventListeners, allowUnknownInvokes, initialProfileFiles }
  );
}
