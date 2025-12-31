import { z } from 'zod';

/** Windows reserved device names (case-insensitive) */
const WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

/** Valid profile extensions */
export const VALID_EXTENSIONS = ['.json', '.jsonc', '.json5'] as const;
export type ValidExtension = typeof VALID_EXTENSIONS[number];

/**
 * Extract extension from filename (.json, .jsonc, .json5)
 */
export function getExtension(filename: string): ValidExtension {
  const match = filename.match(/\.(jsonc|json5|json)$/i);
  return match ? (match[0].toLowerCase() as ValidExtension) : '.json';
}

/**
 * Extract basename (filename without extension)
 */
export function getBasename(filename: string): string {
  return filename.replace(/\.(jsonc|json5|json)$/i, '');
}

/**
 * Check if filename contains only allowed characters.
 * Allowed: letters, numbers, spaces, hyphen, underscore, dot.
 */
function hasOnlyAllowedChars(val: string): boolean {
  return /^[a-zA-Z0-9 _.-]+$/.test(val);
}

/**
 * Check if filename contains path separators or drive letters.
 */
function hasPathSeparators(val: string): boolean {
  return /[/\\:]/.test(val);
}

/**
 * Zod schema for profile filename basename (without extension).
 * Validates the base part of a filename before the extension is appended.
 */
export const profileBasenameSchema = z.string()
  .min(1, 'Filename cannot be empty')
  .max(115, 'Filename is too long (max 115 characters for basename)')
  .refine(
    (val) => !hasPathSeparators(val),
    'Filename cannot contain path separators (/, \\) or drive letters (:)'
  )
  .refine(
    (val) => hasOnlyAllowedChars(val),
    'Filename can only contain letters, numbers, spaces, hyphens, underscores, and dots'
  )
  .refine(
    (val) => !val.endsWith(' '),
    'Filename cannot end with a space'
  )
  .refine(
    (val) => !val.endsWith('.'),
    'Filename cannot end with a dot'
  )
  .refine(
    (val) => !WINDOWS_RESERVED_NAMES.includes(val.toUpperCase()),
    'This name is reserved by Windows'
  );

/**
 * Create a Zod schema for a complete profile filename that enforces a specific extension.
 * @param requiredExtension The extension that must be preserved (e.g., '.jsonc')
 */
export function createProfileFilenameSchema(requiredExtension: ValidExtension) {
  return z.string()
    .min(1, 'Filename cannot be empty')
    .max(120, 'Filename is too long (max 120 characters)')
    .refine(
      (val) => !hasPathSeparators(val),
      'Filename cannot contain path separators (/, \\) or drive letters (:)'
    )
    .refine(
      (val) => {
        const ext = getExtension(val);
        return ext.toLowerCase() === requiredExtension.toLowerCase();
      },
      `Extension must remain ${requiredExtension}`
    )
    .refine(
      (val) => {
        const basename = getBasename(val);
        return basename.length > 0;
      },
      'Filename cannot be empty'
    )
    .refine(
      (val) => {
        const basename = getBasename(val);
        return hasOnlyAllowedChars(basename);
      },
      'Filename can only contain letters, numbers, spaces, hyphens, underscores, and dots'
    )
    .refine(
      (val) => {
        const basename = getBasename(val);
        return !basename.endsWith(' ');
      },
      'Filename cannot end with a space before the extension'
    )
    .refine(
      (val) => {
        const basename = getBasename(val);
        return !basename.endsWith('.');
      },
      'Filename cannot have a trailing dot before the extension'
    )
    .refine(
      (val) => {
        const basename = getBasename(val);
        return !WINDOWS_RESERVED_NAMES.includes(basename.toUpperCase());
      },
      'This name is reserved by Windows'
    );
}

/**
 * Validate a profile filename with extension enforcement.
 * Returns { success: true, data: filename } or { success: false, error: string }
 */
export function validateProfileFilename(
  filename: string,
  requiredExtension: ValidExtension
): { success: true; data: string } | { success: false; error: string } {
  const schema = createProfileFilenameSchema(requiredExtension);
  const result = schema.safeParse(filename);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error.issues[0]?.message || 'Invalid filename' };
}
