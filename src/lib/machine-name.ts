/**
 * Best-effort machine (host) name for labelling this computer's automatic
 * hosted backup.
 *
 * Backups are identified by their backend **id**, so this name is only a human
 * label shown in the backup list — using the real hostname lets a user with
 * several machines tell their auto-backups apart instead of seeing a row of
 * identical "This computer" entries.
 *
 * Resolves via the `get_hostname` engine command (Tauri runtime). Anywhere the
 * command is unavailable (pure web, the standalone dev bridge, or an error) it
 * falls back to the generic "This computer" — never throws.
 */

import { safeInvoke } from './tauri-bridge';

const FALLBACK = 'This computer';

export async function getMachineName(): Promise<string> {
  try {
    const name = await safeInvoke<string>('get_hostname');
    return name?.trim() || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
