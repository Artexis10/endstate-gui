/**
 * App Identity Formatting
 * 
 * Centralized logic for displaying app identifiers.
 * Prefers Winget ID (e.g., "Zoom.Zoom") over internal keys (e.g., "zoom-zoom").
 */

/**
 * Format app identity for display.
 * If the app string contains a dot (likely a Winget ID), show it as-is.
 * Otherwise, show the internal key.
 * 
 * @param app - App identifier string
 * @returns Formatted app identity for display
 */
export function formatAppIdentity(app: string): string {
  // If already contains a dot, assume it's a Winget ID and use as-is
  if (app.includes('.')) {
    return app;
  }
  
  // Otherwise, return the internal key as-is
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
