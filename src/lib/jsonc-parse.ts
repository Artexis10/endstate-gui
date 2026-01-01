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
 * Profile manifest structure (minimal for app listing)
 */
export interface ProfileManifest {
  version?: number;
  apps?: ProfileApp[];
}

export interface ProfileApp {
  id: string;
  name?: string;
  driver?: string;
  refs?: {
    windows?: string;
  };
}
