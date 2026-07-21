/**
 * Friendly, jargon-free copy for profile-import failures.
 *
 * The import path (drop / browse in the Set up flow) reaches the backend either
 * through the Tauri IPC bridge or the dev HTTP bridge. When that transport
 * rejects a request the raw error speaks in transport jargon — e.g.
 * "HTTP bridge error: 413 Payload Too Large", "Failed to buffer the request
 * body: length limit exceeded", or "Tauri invoke failed for 'import_zip_from_base64'".
 * Surfacing that verbatim in a toast leaks CLI/HTTP internals to the user
 * (violates the friendly-error UX rule). This maps the known failure shapes to
 * plain-language copy and, for everything else, returns a safe generic line
 * that never echoes the raw transport message.
 */

/** Substrings that indicate the bundle was rejected for being too large. */
const OVERSIZE_PATTERNS: readonly RegExp[] = [
  /payload too large/i,
  /length limit exceeded/i,
  /buffer the request body/i,
  /request entity too large/i,
  /\b413\b/,
];

/** Transport/plumbing prefixes we must never surface to the user. */
const JARGON_PATTERNS: readonly RegExp[] = [
  /http bridge error/i,
  /tauri invoke failed/i,
  /tauri listen failed/i,
  /failed to buffer the request body/i,
];

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err ?? '');
}

/**
 * Build a friendly, jargon-free toast message for a failed profile import.
 *
 * @param fileName - The name of the file the user tried to import.
 * @param err - The thrown error (Error, string, or anything).
 * @returns A single user-facing sentence with no transport/CLI jargon.
 */
export function friendlyImportError(fileName: string, err: unknown): string {
  const raw = messageOf(err);

  if (OVERSIZE_PATTERNS.some((re) => re.test(raw))) {
    return `${fileName} is too large to import. Try a smaller bundle, or open the folder and add it directly.`;
  }

  // Any recognizable transport jargon → generic, safe copy (never echo it).
  if (JARGON_PATTERNS.some((re) => re.test(raw))) {
    return `We couldn't import ${fileName}. Please try again.`;
  }

  // A short, clean engine/CLI message can be shown; otherwise stay generic.
  // Guard against multi-line or oversized blobs that read as raw output.
  const clean = raw.trim();
  if (clean && clean.length <= 120 && !clean.includes('\n')) {
    return `We couldn't import ${fileName}: ${clean}`;
  }

  return `We couldn't import ${fileName}. The file may be damaged or in an unexpected format.`;
}
