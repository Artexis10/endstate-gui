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

/**
 * Transport wrappers the bridge adds around a backend error.
 *
 * `tauri-bridge.ts` rethrows every failed command as
 * `Tauri invoke failed for '<cmd>': <backend message>`. Treating that whole
 * string as jargon discarded the backend's own message along with it — and that
 * message is usually the precise reason, naming the offending field. When a
 * stale payloadRoot rule rejected every bundle captured by engine 2.27.5, all
 * the user ever saw was "Please try again". Peel the wrapper off and judge what
 * it wrapped on its own merits.
 */
const TRANSPORT_WRAPPERS: readonly RegExp[] = [
  /^\s*tauri invoke failed for '[^']*':\s*/i,
  /^\s*http bridge error(?:\s*\(\d+\))?:\s*/i,
];

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err ?? '');
}

/** Strip any stacked transport prefixes, leaving the backend's own message. */
function unwrapTransport(raw: string): string {
  let message = raw.trim();
  // Bounded on purpose: a bridge error is wrapped at most a couple of layers
  // deep, and an unbounded loop over adversarial input earns nothing.
  for (let depth = 0; depth < 4; depth += 1) {
    const before = message;
    for (const wrapper of TRANSPORT_WRAPPERS) {
      message = message.replace(wrapper, '').trim();
    }
    if (message === before) break;
  }
  return message;
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

  // The transport prefix is noise; what it wraps may be the actual reason.
  const clean = unwrapTransport(raw);

  // Nothing survived the unwrap, or what did is still transport plumbing →
  // generic, safe copy (never echo it).
  if (!clean || JARGON_PATTERNS.some((re) => re.test(clean))) {
    return `We couldn't import ${fileName}. Please try again.`;
  }

  // A single-line engine/CLI message can be shown. The cap admits a full
  // validation sentence (which names a field and a path) while still rejecting
  // multi-line blobs and stack traces that read as raw output.
  if (clean.length <= 200 && !clean.includes('\n')) {
    return `We couldn't import ${fileName}: ${clean}`;
  }

  return `We couldn't import ${fileName}. The file may be damaged or in an unexpected format.`;
}
