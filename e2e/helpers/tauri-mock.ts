import { Page } from '@playwright/test';

export interface TauriMockOptions {
  invoke?: {
    [command: string]: any;
  };
  enableEventListeners?: boolean;
}

export async function installTauriMock(page: Page, options: TauriMockOptions = {}) {
  const customHandlers = options.invoke || {};
  const enableEventListeners = options.enableEventListeners || false;

  await page.addInitScript(
    ({ customHandlers, enableEventListeners }) => {
      const eventHandlers: Map<string, Function> = new Map();

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

      (window as any).__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: any) => {
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
            return null;
          }
        },
        ...(enableEventListeners && {
          event: {
            listen: async (event: string, handler: Function) => {
              eventHandlers.set(event, handler);
              return () => eventHandlers.delete(event);
            }
          }
        })
      };

      if (enableEventListeners) {
        (window as any).__test_eventHandlers = eventHandlers;
      }
    },
    { customHandlers, enableEventListeners }
  );
}
