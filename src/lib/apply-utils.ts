import type { ApplyItem } from '../types';

/**
 * Canonical status keys used for filtering and internal logic.
 * These are the source of truth for status identification.
 * See docs/UX_LANGUAGE.md for the full contract.
 */
export type StatusKey = 
  | 'to_install'      // Preview: will be installed
  | 'already_present' // Already on system
  | 'skipped'         // Skipped by filter/policy
  | 'failed'          // Failed (preview or apply)
  | 'installing'      // Apply activity: in progress
  | 'installed'       // Apply result: successfully installed
  | 'cancelled';      // User cancelled

/**
 * Semantic color tokens for status display.
 * Maps to Tailwind CSS color classes.
 */
export type SemanticColor = 'success' | 'info' | 'warn' | 'error' | 'muted';

/**
 * UI Status configuration with labels and colors.
 * Single source of truth for all status display.
 */
export interface UiStatusConfig {
  shortLabel: string;   // For live activity (compact)
  longLabel: string;    // For modals/summaries
  color: SemanticColor; // Semantic color token
}

/**
 * Complete UI status mapping - SINGLE SOURCE OF TRUTH.
 * Both Live Activity and Setup Details MUST consume this mapping.
 */
export const UI_STATUS_MAP: Record<StatusKey, UiStatusConfig> = {
  already_present: {
    shortLabel: 'PRESENT',
    longLabel: 'Already present',
    color: 'success',
  },
  to_install: {
    shortLabel: 'TO INSTALL',
    longLabel: 'To install',
    color: 'info',
  },
  installing: {
    shortLabel: 'INSTALLING',
    longLabel: 'Installing…',
    color: 'info',
  },
  installed: {
    shortLabel: 'INSTALLED',
    longLabel: 'Installed',
    color: 'success',
  },
  skipped: {
    shortLabel: 'SKIPPED',
    longLabel: 'Skipped',
    color: 'warn',
  },
  failed: {
    shortLabel: 'FAILED',
    longLabel: 'Failed',
    color: 'error',
  },
  cancelled: {
    shortLabel: 'CANCELLED',
    longLabel: 'Cancelled',
    color: 'warn',
  },
} as const;

/**
 * Get Tailwind color classes for a semantic color.
 * Returns { text, bg, border } classes.
 */
export function getColorClasses(color: SemanticColor): { text: string; bg: string; border: string } {
  switch (color) {
    case 'success':
      return { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
    case 'info':
      return { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
    case 'warn':
      return { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' };
    case 'error':
      return { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' };
    case 'muted':
    default:
      return { text: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/20' };
  }
}

/**
 * Get UI status config for a StatusKey.
 */
export function getUiStatus(statusKey: StatusKey): UiStatusConfig {
  return UI_STATUS_MAP[statusKey] || UI_STATUS_MAP.skipped;
}

/**
 * Canonical UI labels per UX_LANGUAGE.md contract.
 * @deprecated Use UI_STATUS_MAP instead for new code.
 */
export const STATUS_LABELS = {
  // Preview decision labels
  preview: {
    to_install: 'To install',
    already_present: 'Already present',
    skipped: 'Skipped',
    failed: 'Failed (preview)',
  },
  // Apply activity verbs (in-progress)
  activity: {
    installing: 'Installing…',
    skipping: 'Skipping…',
    verifying: 'Verifying…',
    failed: 'Failed',
  },
  // Apply result labels (terminal states)
  result: {
    installed: 'Installed',
    already_present: 'Already present',
    skipped: 'Skipped',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
} as const;

/**
 * Map engine reason to canonical StatusKey.
 * This is the single source of truth for status normalization.
 */
export function reasonToStatusKey(item: ApplyItem): StatusKey {
  const reason = item.reason?.toLowerCase() || '';
  const status = item.status?.toLowerCase() || '';

  // Failed states
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return 'failed';
  }

  // User denied/cancelled
  if (reason === 'user_denied') {
    return 'cancelled';
  }

  // Installed this run
  if (reason === 'installed') {
    return 'installed';
  }

  // Already present
  if (reason === 'already_installed' || reason === 'already_present') {
    return 'already_present';
  }

  // Would install (preview)
  if (reason === 'would_install') {
    return 'to_install';
  }

  // Skipped/filtered
  if (status === 'skipped' || reason === 'skipped' || reason === 'filtered') {
    return 'skipped';
  }

  // OK status without reason = already present
  if (status === 'ok') {
    return 'already_present';
  }

  // Fallback
  return 'skipped';
}

/**
 * Get the user-facing label for a status key in a given phase.
 */
export function getStatusLabel(
  statusKey: StatusKey,
  phase: 'preview' | 'activity' | 'result'
): string {
  if (phase === 'preview') {
    if (statusKey === 'to_install') return STATUS_LABELS.preview.to_install;
    if (statusKey === 'already_present') return STATUS_LABELS.preview.already_present;
    if (statusKey === 'skipped' || statusKey === 'cancelled') return STATUS_LABELS.preview.skipped;
    if (statusKey === 'failed') return STATUS_LABELS.preview.failed;
    return STATUS_LABELS.preview.skipped;
  }
  
  if (phase === 'activity') {
    if (statusKey === 'installing') return STATUS_LABELS.activity.installing;
    if (statusKey === 'failed') return STATUS_LABELS.activity.failed;
    return STATUS_LABELS.activity.verifying;
  }
  
  // Result phase
  if (statusKey === 'installed') return STATUS_LABELS.result.installed;
  if (statusKey === 'already_present') return STATUS_LABELS.result.already_present;
  if (statusKey === 'skipped') return STATUS_LABELS.result.skipped;
  if (statusKey === 'failed') return STATUS_LABELS.result.failed;
  if (statusKey === 'cancelled') return STATUS_LABELS.result.cancelled;
  return STATUS_LABELS.result.skipped;
}

/**
 * Get the canonical filter key for a status.
 * Used for filtering lists by status.
 */
export function getFilterKey(item: ApplyItem): StatusKey {
  return reasonToStatusKey(item);
}

/**
 * Engine execution phase for UI clarity.
 * Apply runs first, then Verify within the same engine spawn.
 */
export type EnginePhase = 'apply' | 'verify';

/**
 * AppEvent represents a live activity entry during streaming.
 */
export interface AppEvent {
  app: string;
  action: string;
  timestamp?: number;
  statusKey?: StatusKey;  // Canonical status for consistent display
  phase?: EnginePhase;    // Which phase this event occurred in
}

/**
 * UI categories for Apply results.
 * 
 * These are semantic categories that map to user-facing labels:
 * - willBeInstalled: apps that will be installed (from dry-run preview)
 * - installedThisRun: apps that were installed during this apply run
 * - alreadyPresent: apps that were already on the system
 * - needsAttention: apps that failed to install
 * - skipped: apps skipped by filter/policy (advanced, hidden by default)
 */
export type ApplyCategory = 'willBeInstalled' | 'installedThisRun' | 'alreadyPresent' | 'needsAttention' | 'skipped';

/**
 * Categorized item with normalized status.
 */
export interface CategorizedApplyItem extends ApplyItem {
  category: ApplyCategory;
}

/**
 * Grouped items by category and driver.
 */
export interface CategorizedApplyGroups {
  willBeInstalled: Record<string, ApplyItem[]>;
  installedThisRun: Record<string, ApplyItem[]>;
  alreadyPresent: Record<string, ApplyItem[]>;
  needsAttention: Record<string, ApplyItem[]>;
  skipped: Record<string, ApplyItem[]>;
}

/**
 * Map engine reason to UI category.
 * 
 * Engine reason values → UI category:
 * - would_install → willBeInstalled (preview only)
 * - installed → installedThisRun (apply only)
 * - already_installed → alreadyPresent
 * - install_failed → needsAttention
 * - skipped_filtered → skipped
 * - user_denied → skipped (shown as "Cancelled")
 */
export function normalizeApplyStatus(item: ApplyItem): ApplyCategory {
  const status = item.status?.toLowerCase() || '';
  const reason = item.reason?.toLowerCase() || '';

  // Failed always maps to needsAttention
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return 'needsAttention';
  }

  // would_install = preview showing what will be installed
  if (reason === 'would_install') {
    return 'willBeInstalled';
  }

  // installed = actually installed this run
  if (reason === 'installed') {
    return 'installedThisRun';
  }

  // already_installed = already present on system
  if (reason === 'already_installed') {
    return 'alreadyPresent';
  }

  // user_denied = user cancelled/denied the install
  if (reason === 'user_denied') {
    return 'skipped';
  }

  // OK status without specific reason - check if it's a dry-run or real apply
  if (status === 'ok') {
    // Default to installedThisRun for ok status without reason
    return 'installedThisRun';
  }

  // Skipped for other reasons = filtered/policy skip
  if (status === 'skipped') {
    return 'skipped';
  }

  // Fallback: unknown status treated as skipped
  return 'skipped';
}

/**
 * Categorize and group apply items by category and driver.
 */
export function categorizeApplyItems(items: ApplyItem[]): CategorizedApplyGroups {
  const groups: CategorizedApplyGroups = {
    willBeInstalled: {},
    installedThisRun: {},
    alreadyPresent: {},
    needsAttention: {},
    skipped: {},
  };

  for (const item of items) {
    const category = normalizeApplyStatus(item);
    const driver = item.driver || 'unknown';

    if (!groups[category][driver]) {
      groups[category][driver] = [];
    }
    groups[category][driver].push(item);
  }

  return groups;
}

/**
 * Count items in each category.
 */
export function countCategorizedItems(groups: CategorizedApplyGroups): {
  willBeInstalled: number;
  installedThisRun: number;
  alreadyPresent: number;
  needsAttention: number;
  skipped: number;
} {
  const countGroup = (group: Record<string, ApplyItem[]>) =>
    Object.values(group).reduce((sum, items) => sum + items.length, 0);

  return {
    willBeInstalled: countGroup(groups.willBeInstalled),
    installedThisRun: countGroup(groups.installedThisRun),
    alreadyPresent: countGroup(groups.alreadyPresent),
    needsAttention: countGroup(groups.needsAttention),
    skipped: countGroup(groups.skipped),
  };
}

/**
 * Determine if the apply result indicates "ready" state.
 * 
 * Ready = no failures AND no pending installs.
 * "Your computer is ready" ONLY when:
 * - No failures
 * - No pending installs (willBeInstalled = 0)
 * 
 * @param itemCounts - Counts derived from categorizing items
 */
export function isApplyReady(
  itemCounts: { willBeInstalled: number; installedThisRun: number; alreadyPresent: number; needsAttention: number; skipped: number }
): boolean {
  // Not ready if there are failures
  if (itemCounts.needsAttention > 0) {
    return false;
  }
  // Not ready if there are pending installs (preview mode)
  if (itemCounts.willBeInstalled > 0) {
    return false;
  }
  // Ready if we have no failures and no pending
  return true;
}

/**
 * Determine if this is a preview result (has pending installs).
 */
export function isPreviewResult(
  itemCounts: { willBeInstalled: number; installedThisRun: number; alreadyPresent: number; needsAttention: number; skipped: number }
): boolean {
  return itemCounts.willBeInstalled > 0;
}

/**
 * Determine if all apps are already present (nothing to install).
 */
export function isAllAlreadyPresent(
  itemCounts: { willBeInstalled: number; installedThisRun: number; alreadyPresent: number; needsAttention: number; skipped: number }
): boolean {
  // All already present = no pending installs, no new installs, no failures, and at least one already present
  const noPending = itemCounts.willBeInstalled === 0;
  const noNewInstalls = itemCounts.installedThisRun === 0;
  const noFailures = itemCounts.needsAttention === 0;
  const hasAlreadyPresent = itemCounts.alreadyPresent > 0;

  return noPending && noNewInstalls && noFailures && hasAlreadyPresent;
}

/**
 * Result from parsing a streaming log line.
 */
export interface ParsedProgressLine {
  app: string;
  action: string;
  statusKey: StatusKey;
  isPhaseMarker?: boolean;  // True if this line indicates a phase transition
  phase?: EnginePhase;      // The phase this event belongs to
}

/**
 * Detect if a line indicates the start of verification phase.
 * Returns true if the line signals transition from apply to verify.
 */
export function isVerifyPhaseMarker(line: string): boolean {
  if (!line) return false;
  const lower = line.toLowerCase();
  return lower.includes('verifying') || 
         lower.includes('verification') ||
         lower.includes('[verify]') ||
         lower.includes('checking installation');
}

/**
 * Parse a streaming log line to extract current app and action.
 * Returns null if the line doesn't contain app progress info.
 * 
 * Patterns matched:
 * - [OK] App.Id (driver: winget) - already installed
 * - [OK] App.Id (driver: winget) - Installed successfully
 * - [INSTALL] App.Id (driver: winget)
 * - [SKIP] App.Id - already installed
 * - [SKIP] App.Id - filtered
 * - [FAIL] App.Id - error message
 * - [MISSING] App.Id (driver: winget)
 * - [ACTION] Installing App.Id via winget
 * - [PLAN] App.Id - would install
 * - Found Discord.Discord [Discord.Discord]
 * - Installing Discord.Discord...
 * - Successfully installed Discord.Discord
 */
export function parseApplyProgressLine(line: string): { app: string; action: string; statusKey?: StatusKey } | null {
  if (!line || typeof line !== 'string') {
    return null;
  }

  // [OK] App.Id (driver: ...) - message
  // [OK] means verified/present - NOT the same as Skipped or Installed
  // Keep it truthful: OK means "verified OK" not "skipped" or "installed"
  const okMatch = line.match(/\[OK\]\s+(\S+)/i);
  if (okMatch) {
    return { app: okMatch[1], action: 'OK', statusKey: 'already_present' };
  }

  // [INSTALL] App.Id (driver: ...) - this is the START of an install, not completion
  // Treat as "Processing" - the actual result comes later
  const installMatch = line.match(/\[INSTALL\]\s+(\S+)/i);
  if (installMatch) {
    return { app: installMatch[1], action: 'Processing', statusKey: 'installing' };
  }

  // [PLAN] App.Id - to install (preview)
  const planMatch = line.match(/\[PLAN\]\s+(\S+)/i);
  if (planMatch) {
    return { app: planMatch[1], action: 'To install', statusKey: 'to_install' };
  }

  // [ACTION] Installing App.Id via winget - this is processing, not completion
  const actionMatch = line.match(/\[ACTION\]\s+(?:Installing|Checking)\s+(\S+)/i);
  if (actionMatch) {
    return { app: actionMatch[1], action: 'Processing', statusKey: 'installing' };
  }

  // [SKIP] App.Id - reason
  // CRITICAL: Check reason to distinguish "already installed" from true skips
  const skipMatch = line.match(/\[SKIP\]\s+(\S+)(?:\s+-\s+(.+))?/i);
  if (skipMatch) {
    const app = skipMatch[1];
    const reason = skipMatch[2]?.toLowerCase() || '';
    
    // If skipped because already installed/present, map to OK (already present)
    if (reason.includes('already installed') || reason.includes('already present') || reason.includes('no action')) {
      return { app, action: 'OK', statusKey: 'already_present' };
    }
    
    // Otherwise it's a true skip (filtered, policy, etc.)
    return { app, action: 'Skipped', statusKey: 'skipped' };
  }

  // [FAIL] App.Id - error
  const failMatch = line.match(/\[FAIL\]\s+(\S+)/i);
  if (failMatch) {
    return { app: failMatch[1], action: 'Failed', statusKey: 'failed' };
  }

  // [MISSING] App.Id (driver: ...)
  const missingMatch = line.match(/\[MISSING\]\s+(\S+)/i);
  if (missingMatch) {
    return { app: missingMatch[1], action: 'Missing', statusKey: 'failed' };
  }

  // [VERSION] App.Id - version mismatch
  const versionMatch = line.match(/\[VERSION\]\s+(\S+)/i);
  if (versionMatch) {
    return { app: versionMatch[1], action: 'Version mismatch', statusKey: 'failed' };
  }

  // Winget-style: Found/Installing/Successfully installed App.Name [App.Id]
  const wingetMatch = line.match(/(?:Found|Installing|Successfully installed)\s+[^\[]*\[([^\]]+)\]/i);
  if (wingetMatch) {
    // Only "Successfully installed" is a definitive install - others are processing
    if (line.toLowerCase().includes('successfully installed')) {
      return { app: wingetMatch[1], action: 'Installed', statusKey: 'installed' };
    }
    return { app: wingetMatch[1], action: 'Processing', statusKey: 'installing' };
  }

  return null;
}

/**
 * Streaming line buffer for handling partial lines.
 * Accumulates data and yields complete lines.
 */
export class StreamingLineBuffer {
  private buffer: string = '';

  /**
   * Append data to the buffer and return complete lines.
   */
  append(data: string): string[] {
    this.buffer += data;
    const lines: string[] = [];
    
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      // Trim carriage return if present (Windows line endings)
      lines.push(line.replace(/\r$/, ''));
    }
    
    return lines;
  }

  /**
   * Get any remaining partial line in the buffer.
   */
  getRemaining(): string {
    return this.buffer;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = '';
  }
}

/**
 * Map engine item reason to a user-friendly action string and statusKey for live activity.
 * This is the source of truth for how items appear in the live activity list.
 */
export function reasonToAction(item: ApplyItem): { action: string; statusKey: StatusKey } {
  const reason = item.reason?.toLowerCase() || '';
  const status = item.status?.toLowerCase() || '';

  // Failed states
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return { action: 'Failed', statusKey: 'failed' };
  }

  // User denied/cancelled
  if (reason === 'user_denied') {
    return { action: 'Cancelled', statusKey: 'cancelled' };
  }

  // Installed this run
  if (reason === 'installed') {
    return { action: 'Installed', statusKey: 'installed' };
  }

  // Already present
  if (reason === 'already_installed') {
    return { action: 'OK', statusKey: 'already_present' };
  }

  // To install (preview) - canonical label per UX_LANGUAGE.md
  if (reason === 'would_install') {
    return { action: 'To install', statusKey: 'to_install' };
  }

  // Skipped/filtered
  if (status === 'skipped' || reason === 'skipped' || reason === 'filtered') {
    return { action: 'Skipped', statusKey: 'skipped' };
  }

  // OK status without reason
  if (status === 'ok') {
    return { action: 'OK', statusKey: 'already_present' };
  }

  // Fallback
  return { action: 'Unknown', statusKey: 'skipped' };
}

/**
 * Legacy wrapper for reasonToAction that returns just the action string.
 * @deprecated Use reasonToAction directly and access .action property.
 */
export function reasonToActionString(item: ApplyItem): string {
  return reasonToAction(item).action;
}

/**
 * Reconcile live activity events with the final JSON envelope.
 * 
 * This function takes the streaming live activity state and reconciles it
 * with the authoritative final JSON envelope from the engine. This ensures:
 * - Any "Working..." entries are updated to their final status
 * - Failed items show as "Failed" even if streaming missed the failure
 * - Items with null message get a fallback message
 * 
 * @param liveEvents - Current live activity events from streaming
 * @param envelopeItems - Final items from the JSON envelope (source of truth)
 * @returns Reconciled app events with correct final statuses
 */
export function reconcileLiveActivity(
  liveEvents: AppEvent[],
  envelopeItems: ApplyItem[]
): AppEvent[] {
  // Build a map of envelope items by id for O(1) lookup
  const envelopeMap = new Map<string, ApplyItem>();
  for (const item of envelopeItems) {
    envelopeMap.set(item.id, item);
  }

  // Build result: start with live events, update from envelope
  const resultMap = new Map<string, AppEvent>();
  
  // First, add all live events
  for (const event of liveEvents) {
    resultMap.set(event.app, event);
  }

  // Then, reconcile with envelope (envelope is source of truth)
  for (const item of envelopeItems) {
    const { action, statusKey } = reasonToAction(item);
    const existing = resultMap.get(item.id);
    
    // Always update to final status from envelope
    resultMap.set(item.id, {
      app: item.id,
      action,
      statusKey,
      timestamp: existing?.timestamp ?? Date.now(),
    });
  }

  // Convert back to array, preserving insertion order from live events
  // then adding any envelope items that weren't in live events
  const result: AppEvent[] = [];
  const seen = new Set<string>();
  
  // First, add items in live event order (with updated actions)
  for (const event of liveEvents) {
    const reconciled = resultMap.get(event.app);
    if (reconciled && !seen.has(event.app)) {
      result.push(reconciled);
      seen.add(event.app);
    }
  }
  
  // Then, add any envelope items not in live events
  for (const item of envelopeItems) {
    if (!seen.has(item.id)) {
      const reconciled = resultMap.get(item.id);
      if (reconciled) {
        result.push(reconciled);
        seen.add(item.id);
      }
    }
  }

  return result;
}

/**
 * Get a user-friendly message for a failed item.
 * If the item has no message, returns a fallback.
 */
export function getFailedItemMessage(item: ApplyItem): string {
  if (item.message && item.message.trim()) {
    return item.message;
  }
  return 'Install failed (no details returned)';
}
