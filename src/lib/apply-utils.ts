import type { ApplyItem } from '../types';

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
export function parseApplyProgressLine(line: string): { app: string; action: string } | null {
  if (!line || typeof line !== 'string') {
    return null;
  }

  // [OK] App.Id (driver: ...) - message
  const okMatch = line.match(/\[OK\]\s+(\S+)/i);
  if (okMatch) {
    const isAlready = line.toLowerCase().includes('already');
    return { app: okMatch[1], action: isAlready ? 'Already installed' : 'Installed' };
  }

  // [INSTALL] App.Id (driver: ...)
  const installMatch = line.match(/\[INSTALL\]\s+(\S+)/i);
  if (installMatch) {
    return { app: installMatch[1], action: 'Installing' };
  }

  // [PLAN] App.Id - would install
  const planMatch = line.match(/\[PLAN\]\s+(\S+)/i);
  if (planMatch) {
    return { app: planMatch[1], action: 'Would install' };
  }

  // [ACTION] Installing App.Id via winget
  const actionMatch = line.match(/\[ACTION\]\s+(?:Installing|Checking)\s+(\S+)/i);
  if (actionMatch) {
    return { app: actionMatch[1], action: 'Installing' };
  }

  // [SKIP] App.Id - reason
  const skipMatch = line.match(/\[SKIP\]\s+(\S+)/i);
  if (skipMatch) {
    const isAlready = line.toLowerCase().includes('already');
    return { app: skipMatch[1], action: isAlready ? 'Already installed' : 'Skipped' };
  }

  // [FAIL] App.Id - error
  const failMatch = line.match(/\[FAIL\]\s+(\S+)/i);
  if (failMatch) {
    return { app: failMatch[1], action: 'Failed' };
  }

  // [MISSING] App.Id (driver: ...)
  const missingMatch = line.match(/\[MISSING\]\s+(\S+)/i);
  if (missingMatch) {
    return { app: missingMatch[1], action: 'Missing' };
  }

  // [VERSION] App.Id - version mismatch
  const versionMatch = line.match(/\[VERSION\]\s+(\S+)/i);
  if (versionMatch) {
    return { app: versionMatch[1], action: 'Version mismatch' };
  }

  // Winget-style: Found/Installing/Successfully installed App.Name [App.Id]
  const wingetMatch = line.match(/(?:Found|Installing|Successfully installed)\s+[^\[]*\[([^\]]+)\]/i);
  if (wingetMatch) {
    const action = line.toLowerCase().includes('successfully') ? 'Installed' :
                   line.toLowerCase().includes('installing') ? 'Installing' : 'Checking';
    return { app: wingetMatch[1], action };
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
