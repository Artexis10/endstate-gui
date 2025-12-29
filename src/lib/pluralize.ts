/**
 * Simple pluralization helper for count-based strings.
 * 
 * @param count - The count to check
 * @param singular - Singular form (e.g., "app")
 * @param plural - Optional plural form (defaults to singular + "s")
 * @returns The appropriate form based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return singular;
  }
  return plural ?? `${singular}s`;
}

/**
 * Format a count with its pluralized noun.
 * 
 * @param count - The count to display
 * @param singular - Singular form (e.g., "app")
 * @param plural - Optional plural form (defaults to singular + "s")
 * @returns Formatted string like "1 app" or "5 apps"
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}
