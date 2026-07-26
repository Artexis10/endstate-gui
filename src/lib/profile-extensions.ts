/**
 * The single definition of what an Endstate profile file looks like from the
 * outside — for the whole frontend.
 *
 * Every drop target, import transport, file-dialog filter, and schedule check
 * used to carry its own copy of "is this a zip?". They drifted: adding an
 * extension meant finding all of them, and missing one produced a file the app
 * accepted in one place and silently ignored in another. Import from here
 * instead of writing another `endsWith('.zip')`.
 *
 * `.endstate` is a capture bundle: an ordinary zip container with
 * `manifest.jsonc` at its root. `.zip` is the same container under the name
 * capture used to write, and is accepted permanently — this was a rename, not
 * a format change, and a bundle renamed back to `.zip` still opens in any
 * archiver. Matching is case-insensitive everywhere.
 *
 * Mirrors the engine's `manifest.BundleExtensions`
 * (../endstate/go-engine/internal/manifest/bundle_source.go).
 */

/** Bundle extensions, most preferred first. Leading dot, lowercase. */
export const BUNDLE_EXTENSIONS = ['.endstate', '.zip'] as const;

/** Bare-manifest extensions. Leading dot, lowercase. */
export const MANIFEST_EXTENSIONS = ['.json', '.jsonc', '.json5'] as const;

/** Everything the profile import surface accepts, most preferred first. */
export const PROFILE_EXTENSIONS = [
  ...BUNDLE_EXTENSIONS,
  ...MANIFEST_EXTENSIONS,
] as const;

/**
 * The same lists without the leading dot, for the Tauri dialog plugin's
 * `filters[].extensions` and for OS-level filter strings.
 */
export const BUNDLE_DIALOG_EXTENSIONS = BUNDLE_EXTENSIONS.map(stripDot);
export const PROFILE_DIALOG_EXTENSIONS = PROFILE_EXTENSIONS.map(stripDot);

/** The extension capture writes by default. */
export const DEFAULT_BUNDLE_EXTENSION = BUNDLE_EXTENSIONS[0];

function stripDot(ext: string): string {
  return ext.replace(/^\./, '');
}

function hasExtension(
  pathOrName: string,
  extensions: readonly string[],
): boolean {
  const lower = pathOrName.trim().toLowerCase();
  return extensions.some(ext => lower.endsWith(ext));
}

/** True when the path or file name names a capture bundle (.endstate or .zip). */
export function isBundlePath(pathOrName: string): boolean {
  return hasExtension(pathOrName, BUNDLE_EXTENSIONS);
}

/** True when the path or file name names a bare manifest (.json/.jsonc/.json5). */
export function isManifestPath(pathOrName: string): boolean {
  return hasExtension(pathOrName, MANIFEST_EXTENSIONS);
}

/** True when the path or file name is something the import surface accepts. */
export function isSupportedProfilePath(pathOrName: string): boolean {
  return hasExtension(pathOrName, PROFILE_EXTENSIONS);
}
