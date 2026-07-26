/**
 * Opening a capture bundle from outside the app — the Windows file association.
 *
 * `bundle.fileAssociations` in `tauri.conf.json` makes the installer register
 * `endstate.exe "%1"` as the handler for `.endstate`, so double-clicking a
 * bundle hands us its path on the command line. Two arrival routes, one
 * destination:
 *
 *  - **Cold start** — the app was not running. Rust parks `argv` at process
 *    start and the frontend drains it once on mount (`take_opened_file_args`),
 *    because at launch there is no webview to receive an event.
 *  - **Warm start** — the app was already running. The single-instance plugin
 *    hands the second process's `argv` to the first, which focuses its window
 *    and emits `endstate://opened-files`.
 *
 * Both routes end in {@link beginProfileImport} — the same funnel the native
 * drag-drop handler uses — so an opened file and a dropped file are
 * indistinguishable from there on, including the busy-state refusal.
 */

import { beginProfileImport, type ProfileImportDependencies } from './native-profile-drop';
import { isSupportedProfilePath } from './profile-extensions';

/** Event name the Rust single-instance callback emits on a warm start. */
export const OPENED_FILES_EVENT = 'endstate://opened-files';

/**
 * True for an argument that is an option rather than a file operand.
 *
 * We are handed raw `argv`, which in practice carries more than the file the
 * user opened: the updater relaunches with `--updated`, and dev and webview
 * flags come through too. Screening options out first matters because an option
 * can carry a value that ends in a profile extension (`--config=x.json`), which
 * the extension predicate alone would happily accept.
 */
function isOptionArgument(argument: string): boolean {
  return argument.trim().startsWith('-');
}

/**
 * Decide which launch arguments name a profile the app should import.
 *
 * Pure, and deliberately the only place the decision lives. Extension
 * membership comes from the shared predicate in `./profile-extensions`, so this
 * accepts exactly what every other import surface accepts — bundles and bare
 * manifests alike. Anything else (options, empty argv, a stray path to
 * something that is not a profile) yields no paths, and therefore no import and
 * no error toast.
 */
export function selectProfilePathsFromArgv(argv: readonly string[]): string[] {
  return argv.filter(
    argument => !isOptionArgument(argument) && isSupportedProfilePath(argument),
  );
}

/**
 * Build the handler for launch arguments, for both the cold-start drain and the
 * warm-start event. Arguments that name no profile are silently ignored.
 */
export function createOpenedFilesHandler(
  dependencies: ProfileImportDependencies,
): (argv: readonly string[] | null | undefined) => void {
  return argv => {
    if (!argv) return;
    beginProfileImport(dependencies, selectProfilePathsFromArgv(argv));
  };
}
