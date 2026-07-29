/**
 * Simple JSONC (JSON with Comments) parser
 * Strips single-line (//) and multi-line block comments before parsing
 */

/**
 * Strip comments from JSONC/JSON5 content
 * Handles single-line comments (//) and multi-line block comments
 */
export function stripJsonComments(content: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle string boundaries
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      // Check for escape sequences
      if (char === '\\' && i + 1 < content.length) {
        result += char + nextChar;
        i += 2;
        continue;
      }
      // Check for end of string
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      result += char;
      i++;
      continue;
    }

    // Single-line comment
    if (char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Multi-line comment
    if (char === '/' && nextChar === '*') {
      i += 2;
      // Skip until */
      while (i < content.length - 1) {
        if (content[i] === '*' && content[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Parse JSONC content (JSON with comments)
 * Returns the parsed object or throws an error
 */
export function parseJsonc<T = unknown>(content: string): T {
  const stripped = stripJsonComments(content);
  return JSON.parse(stripped) as T;
}

/**
 * Profile manifest structure.
 *
 * Every field is optional because the manifest is untrusted input read straight
 * off disk — the engine validator (`validate_profile`) is the contract, not this
 * type. Manifest v1 carries settings as flat `restore` entries; v2 carries them
 * as `configCaptures`.
 */
export interface ProfileManifest {
  version?: number;
  name?: string;
  /** ISO 8601 capture timestamp. The field is `captured`, not `capturedAt`. */
  captured?: string;
  apps?: ProfileApp[];
  includes?: string[];
  /** Manifest v1 settings lane. */
  restore?: ProfileRestoreEntry[];
  /** Manifest v2 settings lane. */
  configCaptures?: ProfileConfigCapture[];
}

export interface ProfileApp {
  id: string;
  /** Friendly name written by capture (e.g. "7-Zip 25.01 (x64)"). */
  displayName?: string;
  name?: string;
  driver?: string;
  refs?: {
    windows?: string;
  };
}
/** One manifest-v1 restore operation. Module identity is derived from `source`. */
export interface ProfileRestoreEntry {
  type?: string;
  /** Bundle-relative payload path, e.g. `./configs/<module-id>/config.xml`. */
  source?: string;
  target?: string;
  /** Explicit module id, present on profiles captured after the field existed. */
  fromModule?: string;
}

/** One manifest-v2 captured config set. */
export interface ProfileConfigCapture {
  captureId?: string;
  moduleId?: string;
  configSetId?: string;
  sourceInstance?: {
    evidence?: {
      ref?: string;
    };
  };
  captureModule?: {
    /** Bundle-relative path to the module snapshot, under `provenance/modules/`. */
    snapshotPath?: string;
  };
  payloadManifest?: Array<{ relativePath?: string }>;
}

/**
 * The inspectable module snapshot a v2 bundle ships alongside its payload. It is
 * the only on-disk source of a real display name for a captured config module.
 */
export interface ProfileModuleSnapshot {
  id?: string;
  displayName?: string;
}
