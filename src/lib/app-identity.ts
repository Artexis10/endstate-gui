/**
 * App Identity Formatting
 * 
 * Centralized logic for displaying app identifiers.
 * Prefers Winget ID (e.g., "Zoom.Zoom") over internal keys (e.g., "zoom-zoom").
 */

/**
 * Format app identity for display.
 * Returns the raw winget ID as-is. The Go engine provides proper display
 * names via the `name` field; this is the safe fallback when name is absent.
 *
 * @param app - App identifier string
 * @returns The app identifier unchanged
 */
export function formatAppIdentity(app: string): string {
  return app;
}

/**
 * Extract display name and Winget ID from app identifier.
 * Returns both parts if available for rich display.
 *
 * @param app - App identifier string
 * @returns Object with displayName and wingetId (if available)
 */
export function parseAppIdentity(app: string): { displayName: string; wingetId?: string } {
  // Check if this looks like a Winget ID (contains dot)
  if (app.includes('.')) {
    return {
      displayName: app,
      wingetId: app,
    };
  }

  // Otherwise, just the internal key
  return {
    displayName: app,
  };
}
