import type { ApplyItem, ApplyCounts } from '../types';

/**
 * Normalized status categories for Apply results.
 * These map engine status/reason combinations to UI categories.
 */
export type ApplyCategory = 'installed' | 'alreadyInstalled' | 'skipped' | 'failed';

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
  installed: Record<string, ApplyItem[]>;
  alreadyInstalled: Record<string, ApplyItem[]>;
  skipped: Record<string, ApplyItem[]>;
  failed: Record<string, ApplyItem[]>;
}

/**
 * Normalize an apply item's status/reason to a UI category.
 * 
 * Engine status values:
 * - status: 'ok' | 'skipped' | 'failed'
 * - reason: 'installed' | 'would_install' | 'already_installed' | 'install_failed' | etc.
 * 
 * UI categories:
 * - installed: newly installed apps (status=ok, reason=installed|would_install)
 * - alreadyInstalled: apps that were already present (status=skipped, reason=already_installed)
 * - skipped: apps skipped by filter/policy (status=skipped, reason!=already_installed)
 * - failed: apps that failed to install (status=failed)
 */
export function normalizeApplyStatus(item: ApplyItem): ApplyCategory {
  const status = item.status?.toLowerCase() || '';
  const reason = item.reason?.toLowerCase() || '';

  // Failed always maps to failed
  if (status === 'failed' || reason === 'install_failed' || reason === 'failed') {
    return 'failed';
  }

  // OK with installed/would_install reason = newly installed
  if (status === 'ok') {
    if (reason === 'installed' || reason === 'would_install') {
      return 'installed';
    }
    // OK without specific reason - assume installed
    return 'installed';
  }

  // Skipped with already_installed reason = already installed
  if (status === 'skipped') {
    if (reason === 'already_installed') {
      return 'alreadyInstalled';
    }
    // Skipped for other reasons = filtered/policy skip
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
    installed: {},
    alreadyInstalled: {},
    skipped: {},
    failed: {},
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
  installed: number;
  alreadyInstalled: number;
  skipped: number;
  failed: number;
} {
  const countGroup = (group: Record<string, ApplyItem[]>) =>
    Object.values(group).reduce((sum, items) => sum + items.length, 0);

  return {
    installed: countGroup(groups.installed),
    alreadyInstalled: countGroup(groups.alreadyInstalled),
    skipped: countGroup(groups.skipped),
    failed: countGroup(groups.failed),
  };
}

/**
 * Determine if the apply result indicates "ready" state.
 * 
 * Ready = no failed apps AND (installed + alreadyInstalled) covers all expected apps.
 * 
 * @param counts - The counts from the envelope
 * @param itemCounts - Counts derived from categorizing items
 */
export function isApplyReady(
  counts: ApplyCounts,
  itemCounts: { installed: number; alreadyInstalled: number; skipped: number; failed: number }
): boolean {
  // If there are any failed items, not ready
  if (counts.failed > 0 || itemCounts.failed > 0) {
    return false;
  }

  // Ready if we have no failures
  return true;
}

/**
 * Determine if all apps are "up to date" (nothing newly installed, all already present).
 */
export function isAllUpToDate(
  counts: ApplyCounts,
  itemCounts: { installed: number; alreadyInstalled: number; skipped: number; failed: number }
): boolean {
  // All up to date = no new installs, no failures, and at least one already installed
  const noNewInstalls = counts.installed === 0 && itemCounts.installed === 0;
  const noFailures = counts.failed === 0 && itemCounts.failed === 0;
  const hasAlreadyInstalled = counts.alreadyInstalled > 0 || itemCounts.alreadyInstalled > 0;

  return noNewInstalls && noFailures && hasAlreadyInstalled;
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
