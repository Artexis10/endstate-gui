import { Page } from '@playwright/test';

export interface TauriMockOptions {
  invoke?: {
    [command: string]: any;
  };
  enableEventListeners?: boolean;
  allowUnknownInvokes?: boolean;
}

export async function installTauriMock(page: Page, options: TauriMockOptions = {}) {
  const customHandlers = options.invoke || {};
  const enableEventListeners = options.enableEventListeners || false;
  const allowUnknownInvokes = options.allowUnknownInvokes || false;

  await page.addInitScript(
    ({ customHandlers, enableEventListeners, allowUnknownInvokes }) => {
      // Support multiple listeners per event topic
      const eventListeners: Map<string, Set<Function>> = new Map();

      const defaultHandlers: { [key: string]: (args?: any) => any } = {
        ensure_dir: () => null,
        read_dir: () => [],
        list_manifest_files: () => [],
        get_default_profiles_directory: () => 'C:\\test\\profiles',
        get_capture_cache_directory: () => 'C:\\test\\cache',
        read_text_file: () => '{"version": 1, "apps": []}',
        check_file_exists: () => false,
        validate_profile: () => ({ valid: true, summary: { name: 'test', version: 1, appCount: 0 } }),
        delete_file: () => null,
        delete_file_silent: () => null,
        rename_file: () => null,
        write_text_file: () => null,
        copy_file: () => null,
        cleanup_capture_cache: () => null,
        show_file_dialog: () => null,
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

      (window as any).__TAURI__ = {
        core: {
          invoke: invokeImpl
        },
        // Top-level invoke alias (matches tauri-bridge contract)
        invoke: invokeImpl,
        ...(enableEventListeners && {
          event: {
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
          }
        }),
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
    { customHandlers, enableEventListeners, allowUnknownInvokes }
  );
}
