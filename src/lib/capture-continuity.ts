/**
 * Capture Continuity Helpers
 * 
 * Implements INV-CONTINUITY-1: counts.included must equal appsIncluded.length
 * Implements INV-DETAILS-1: Capture Details UI must render app list from canonical source
 * 
 * @see openspec/specs/engine-capture-contract.md#invariants
 */

import type { EndstateCaptureData, CapturedApp } from '../types';
import type { AppEvent } from './apply-utils';

/**
 * Canonical source for capture app list.
 * Per INV-DETAILS-1: prefer appsIncluded from engine envelope.
 */
export function getCaptureAppsFromEnvelope(envelopeData: EndstateCaptureData | undefined): CapturedApp[] {
  return envelopeData?.appsIncluded ?? [];
}

/**
 * Derive captured count from envelope data.
 * Per INV-CONTINUITY-1: counts.included must equal appsIncluded.length.
 */
export function getCapturedCount(envelopeData: EndstateCaptureData | undefined): number {
  // Prefer counts.included if available
  if (envelopeData?.counts?.included !== undefined) {
    return envelopeData.counts.included;
  }
  // Fallback to appsIncluded length
  if (envelopeData?.appsIncluded) {
    return envelopeData.appsIncluded.length;
  }
  return 0;
}

/**
 * Validate continuity invariant: counts.included === appsIncluded.length
 * Returns true if invariant holds, false if violated.
 */
export function validateContinuityInvariant(envelopeData: EndstateCaptureData | undefined): boolean {
  if (!envelopeData) return true; // No data = no violation
  
  const countsIncluded = envelopeData.counts?.included;
  const appsLength = envelopeData.appsIncluded?.length ?? 0;
  
  // If counts.included is defined, it must match appsIncluded.length
  if (countsIncluded !== undefined) {
    return countsIncluded === appsLength;
  }
  
  return true; // No counts.included = no violation
}

/**
 * Convert captured apps to AppEvents for display in ActionDetailsModal.
 * Per INV-DETAILS-1: Capture Details modal must show scrollable list of captured apps.
 */
export function capturedAppsToAppEvents(apps: CapturedApp[] | string[]): AppEvent[] {
  return apps.map(app => {
    const appId = typeof app === 'string' ? app : app.id;
    return {
      app: appId,
      action: 'Captured',
      statusKey: 'detected' as const,
      phase: 'capture' as const,
    };
  });
}

/**
 * Validate that an app ID is sanitized (no leading non-ASCII characters).
 * Per INV-SANITIZE-1: GUI relies on engine sanitization (engine INV-SANITIZE-IDS-1).
 * @see openspec/specs/engine-capture-contract.md#inv-sanitize-1
 */
export function isCleanAppId(id: string): boolean {
  if (!id || id.length === 0) return false;
  // Trim and check for empty/whitespace-only
  const trimmed = id.trim();
  if (trimmed.length === 0) return false;
  const firstChar = trimmed.charCodeAt(0);
  // Must start with ASCII printable character (0x21-0x7E, excluding space)
  if (firstChar < 0x21 || firstChar > 0x7E) return false;
  // Must not contain backslashes (ARP/MSIX entries)
  if (id.includes('\\')) return false;
  return true;
}

/**
 * Filter and validate captured apps, returning only clean IDs.
 * This is a defensive check - engine should already sanitize.
 */
export function filterCleanApps(apps: CapturedApp[]): CapturedApp[] {
  return apps.filter(app => isCleanAppId(app.id));
}

/**
 * Get count of captured config modules from envelope data.
 * @param envelopeData - Capture envelope data from engine
 * @returns Number of config modules successfully captured
 */
export function getCapturedConfigCount(envelopeData: EndstateCaptureData | undefined): number {
  return envelopeData?.configsIncluded?.length ?? 0;
}

/**
 * Derive capture summary text from count.
 * Used for Overview card subtitle and modal summary.
 * @param count - Number of captured apps
 * @param configCount - Number of captured config modules (optional)
 * @returns Summary text like "67 apps captured · 12 configs included" or "No apps detected"
 */
export function deriveCaptureSummaryText(count: number, configCount?: number): string {
  const appText = count === 0 ? 'No apps detected' : `${count} apps captured`;
  if (configCount && configCount > 0) {
    return `${appText} · ${configCount} configs included`;
  }
  return appText;
}

/** Config data for building capture action result */
export interface CaptureConfigData {
  outputFormat?: 'jsonc' | 'zip';
  configsIncluded?: string[];
  configsSkipped?: string[];
  configsCaptureErrors?: string[];
}

/**
 * Build capture action result for ActionDetailsModal.
 * Per INV-DETAILS-1: ensures appEvents is populated from canonical CapturedApp[] list.
 * @see openspec/specs/engine-capture-contract.md#inv-details-1
 */
export function buildCaptureActionResult(
  capturedApps: CapturedApp[],
  summary: string,
  configData?: CaptureConfigData
): {
  action: 'capture';
  status: 'success';
  summary: string;
  timestamp: string;
  counts: { total: number; configsCaptured?: number; configsSkipped?: number; configsErrored?: number };
  appEvents: AppEvent[];
  outputFormat?: 'jsonc' | 'zip';
  configsIncluded?: string[];
  configsSkipped?: string[];
  configsCaptureErrors?: string[];
} {
  // Convert CapturedApp[] to AppEvents for modal display (INV-DETAILS-1)
  const appEvents = capturedAppsToAppEvents(capturedApps);

  // Count derived from list length for consistency (INV-CONTINUITY-1)
  const count = appEvents.length;

  // Build counts with optional config fields
  const counts: { total: number; configsCaptured?: number; configsSkipped?: number; configsErrored?: number } = { total: count };
  if (configData?.configsIncluded !== undefined) {
    counts.configsCaptured = configData.configsIncluded.length;
  }
  if (configData?.configsSkipped !== undefined) {
    counts.configsSkipped = configData.configsSkipped.length;
  }
  if (configData?.configsCaptureErrors !== undefined) {
    counts.configsErrored = configData.configsCaptureErrors.length;
  }

  return {
    action: 'capture',
    status: 'success',
    summary,
    timestamp: new Date().toISOString(),
    counts,
    appEvents,
    outputFormat: configData?.outputFormat,
    configsIncluded: configData?.configsIncluded,
    configsSkipped: configData?.configsSkipped,
    configsCaptureErrors: configData?.configsCaptureErrors,
  };
}
