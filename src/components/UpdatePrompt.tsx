/**
 * UpdatePrompt — side-effect component that surfaces Tauri auto-updates as
 * Sonner toasts. Mounted once at the app root; renders nothing.
 *
 * Outside Tauri runtime (web preview, tests) this is a no-op — the plugin
 * modules are dynamically imported so the bundle still builds for web.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { isTauriRuntime } from '../lib/tauri-bridge';

type UpdaterModule = typeof import('@tauri-apps/plugin-updater');
type ProcessModule = typeof import('@tauri-apps/plugin-process');

async function loadUpdater(): Promise<UpdaterModule | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await import('@tauri-apps/plugin-updater');
  } catch (err) {
    console.warn('[updater] plugin not available:', err);
    return null;
  }
}

async function loadProcess(): Promise<ProcessModule | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await import('@tauri-apps/plugin-process');
  } catch (err) {
    console.warn('[updater] process plugin not available:', err);
    return null;
  }
}

async function downloadAndInstall(update: Awaited<ReturnType<UpdaterModule['check']>>): Promise<void> {
  if (!update) return;

  const progressId = toast.loading('Downloading update…', { duration: Infinity });
  let contentLength = 0;
  let downloaded = 0;

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0;
          toast.loading(
            contentLength > 0
              ? `Downloading update (0 / ${formatBytes(contentLength)})…`
              : 'Downloading update…',
            { id: progressId, duration: Infinity },
          );
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          toast.loading(
            contentLength > 0
              ? `Downloading update (${formatBytes(downloaded)} / ${formatBytes(contentLength)})…`
              : `Downloading update (${formatBytes(downloaded)})…`,
            { id: progressId, duration: Infinity },
          );
          break;
        case 'Finished':
          toast.loading('Installing update…', { id: progressId, duration: Infinity });
          break;
      }
    });

    toast.dismiss(progressId);

    const proc = await loadProcess();
    if (proc) {
      await proc.relaunch();
    }
  } catch (err) {
    toast.dismiss(progressId);
    const msg = err instanceof Error ? err.message : String(err);
    toast.error('Update failed', { description: msg });
    console.error('[updater] install failed:', err);
  }
}

function promptForUpdate(update: NonNullable<Awaited<ReturnType<UpdaterModule['check']>>>): void {
  const title = `Endstate ${update.version} is available`;
  const description = update.body?.trim() || 'A new version is ready to install.';

  toast(title, {
    description,
    duration: Infinity,
    action: {
      label: 'Install and restart',
      onClick: () => {
        void downloadAndInstall(update);
      },
    },
    cancel: {
      label: 'Later',
      onClick: () => {
        // dismiss only — next launch will re-check
      },
    },
  });
}

export interface UpdateCheckOptions {
  /** Show "Checking…" / "Up to date" toasts. Defaults to false (silent). */
  manual?: boolean;
}

/**
 * Manually trigger an update check. Safe to call from anywhere.
 * No-op outside Tauri runtime.
 */
export async function runUpdateCheck(options: UpdateCheckOptions = {}): Promise<void> {
  const { manual = false } = options;

  if (!isTauriRuntime()) {
    if (manual) {
      toast.info('Updates are only available in the desktop app');
    }
    return;
  }

  const updater = await loadUpdater();
  if (!updater) {
    if (manual) toast.error('Update check unavailable');
    return;
  }

  const checkingId = manual ? toast.loading('Checking for updates…') : null;

  try {
    const update = await updater.check();
    if (checkingId !== null) toast.dismiss(checkingId);

    if (update) {
      promptForUpdate(update);
    } else if (manual) {
      toast.success('Endstate is up to date');
    }
  } catch (err) {
    if (checkingId !== null) toast.dismiss(checkingId);
    const msg = err instanceof Error ? err.message : String(err);
    if (manual) {
      toast.error('Update check failed', { description: msg });
    } else {
      console.warn('[updater] silent check failed:', msg);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UpdatePrompt(): null {
  const didCheck = useRef(false);

  useEffect(() => {
    if (didCheck.current) return;
    didCheck.current = true;
    void runUpdateCheck();
  }, []);

  return null;
}
