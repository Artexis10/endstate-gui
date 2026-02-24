import { describe, it, expect } from 'vitest';
import {
  normalizeApplyStatus,
  categorizeApplyItems,
  countCategorizedItems,
  isApplyReady,
  isAllAlreadyPresent,
  isPreviewResult,
  parseApplyProgressLine,
  StreamingLineBuffer,
  reconcileLiveActivity,
  reasonToAction,
  getFailedItemMessage,
  RESTORE_STATUS_MAP,
  getRestoreUiStatus,
  deriveCountersFromEvents,
  type AppEvent,
  type RestoreStatusKey,
} from './apply-utils';
import type { ApplyItem } from '../types';

describe('apply-utils', () => {
  describe('normalizeApplyStatus', () => {
    // Engine reason → UI category mapping tests
    it('maps reason=installed to installedThisRun', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'installed' };
      expect(normalizeApplyStatus(item)).toBe('installedThisRun');
    });

    it('maps reason=would_install to willBeInstalled (preview)', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'would_install' };
      expect(normalizeApplyStatus(item)).toBe('willBeInstalled');
    });

    it('maps status=ok without reason to installedThisRun', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok' };
      expect(normalizeApplyStatus(item)).toBe('installedThisRun');
    });

    it('maps reason=already_installed to alreadyPresent', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'already_installed' };
      expect(normalizeApplyStatus(item)).toBe('alreadyPresent');
    });

    it('maps status=skipped, reason=filtered to skipped', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'filtered' };
      expect(normalizeApplyStatus(item)).toBe('skipped');
    });

    it('maps status=skipped without reason to skipped', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped' };
      expect(normalizeApplyStatus(item)).toBe('skipped');
    });

    it('maps status=failed to needsAttention', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed', reason: 'install_failed' };
      expect(normalizeApplyStatus(item)).toBe('needsAttention');
    });

    it('maps reason=install_failed to needsAttention regardless of status', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'install_failed' };
      expect(normalizeApplyStatus(item)).toBe('needsAttention');
    });

    // Semantic correctness tests - these would have caught the bug
    it('SEMANTIC: would_install NEVER maps to installedThisRun', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'would_install' };
      expect(normalizeApplyStatus(item)).not.toBe('installedThisRun');
    });

    it('SEMANTIC: preview items (would_install) go to willBeInstalled category', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'would_install' };
      expect(normalizeApplyStatus(item)).toBe('willBeInstalled');
    });
  });

  describe('categorizeApplyItems', () => {
    it('groups items by category and driver', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'skipped', reason: 'already_installed' },
        { id: 'App3', driver: 'msstore', status: 'ok', reason: 'installed' },
        { id: 'App4', driver: 'winget', status: 'failed', reason: 'install_failed' },
        { id: 'App5', driver: 'winget', status: 'skipped', reason: 'filtered' },
        { id: 'App6', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];

      const groups = categorizeApplyItems(items);

      expect(groups.installedThisRun.winget).toHaveLength(1);
      expect(groups.installedThisRun.winget[0].id).toBe('App1');
      expect(groups.installedThisRun.msstore).toHaveLength(1);
      expect(groups.installedThisRun.msstore[0].id).toBe('App3');
      expect(groups.alreadyPresent.winget).toHaveLength(1);
      expect(groups.alreadyPresent.winget[0].id).toBe('App2');
      expect(groups.needsAttention.winget).toHaveLength(1);
      expect(groups.needsAttention.winget[0].id).toBe('App4');
      expect(groups.skipped.winget).toHaveLength(1);
      expect(groups.skipped.winget[0].id).toBe('App5');
      expect(groups.willBeInstalled.winget).toHaveLength(1);
      expect(groups.willBeInstalled.winget[0].id).toBe('App6');
    });

    it('handles empty items array', () => {
      const groups = categorizeApplyItems([]);
      expect(groups.installedThisRun).toEqual({});
      expect(groups.alreadyPresent).toEqual({});
      expect(groups.skipped).toEqual({});
      expect(groups.needsAttention).toEqual({});
      expect(groups.willBeInstalled).toEqual({});
    });

    it('uses "unknown" driver when driver is missing', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: '', status: 'ok', reason: 'installed' },
      ];
      const groups = categorizeApplyItems(items);
      expect(groups.installedThisRun.unknown).toHaveLength(1);
    });

    // Semantic correctness: would_install items NEVER appear in installedThisRun
    it('SEMANTIC: would_install items appear in willBeInstalled, not installedThisRun', () => {
      const items: ApplyItem[] = [
        { id: 'Missing.App', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const groups = categorizeApplyItems(items);
      expect(groups.willBeInstalled.winget).toHaveLength(1);
      expect(groups.installedThisRun.winget).toBeUndefined();
    });
  });

  describe('countCategorizedItems', () => {
    it('counts items in each category', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App3', driver: 'winget', status: 'skipped', reason: 'already_installed' },
        { id: 'App4', driver: 'winget', status: 'failed' },
        { id: 'App5', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];

      const groups = categorizeApplyItems(items);
      const counts = countCategorizedItems(groups);

      expect(counts.installedThisRun).toBe(2);
      expect(counts.alreadyPresent).toBe(1);
      expect(counts.skipped).toBe(0);
      expect(counts.needsAttention).toBe(1);
      expect(counts.willBeInstalled).toBe(1);
    });
  });

  describe('isApplyReady', () => {
    it('returns true when no failures and no pending installs', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 2, alreadyPresent: 3, needsAttention: 0, skipped: 0 };
      expect(isApplyReady(itemCounts)).toBe(true);
    });

    it('returns false when there are failures (needsAttention > 0)', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 2, alreadyPresent: 2, needsAttention: 1, skipped: 0 };
      expect(isApplyReady(itemCounts)).toBe(false);
    });

    it('returns false when there are pending installs (willBeInstalled > 0)', () => {
      const itemCounts = { willBeInstalled: 1, installedThisRun: 0, alreadyPresent: 61, needsAttention: 0, skipped: 0 };
      expect(isApplyReady(itemCounts)).toBe(false);
    });

    // SEMANTIC: "Your computer is ready" NEVER appears if pending installs exist
    it('SEMANTIC: ready=false when willBeInstalled > 0 (preview scenario)', () => {
      const itemCounts = { willBeInstalled: 1, installedThisRun: 0, alreadyPresent: 61, needsAttention: 0, skipped: 0 };
      expect(isApplyReady(itemCounts)).toBe(false);
    });
  });

  describe('isPreviewResult', () => {
    it('returns true when willBeInstalled > 0', () => {
      const itemCounts = { willBeInstalled: 1, installedThisRun: 0, alreadyPresent: 61, needsAttention: 0, skipped: 0 };
      expect(isPreviewResult(itemCounts)).toBe(true);
    });

    it('returns false when willBeInstalled = 0', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 1, alreadyPresent: 61, needsAttention: 0, skipped: 0 };
      expect(isPreviewResult(itemCounts)).toBe(false);
    });
  });

  describe('isAllAlreadyPresent', () => {
    it('returns true when all apps already present and none pending or installed', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 0, alreadyPresent: 5, needsAttention: 0, skipped: 0 };
      expect(isAllAlreadyPresent(itemCounts)).toBe(true);
    });

    it('returns false when some apps were installed this run', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 2, alreadyPresent: 3, needsAttention: 0, skipped: 0 };
      expect(isAllAlreadyPresent(itemCounts)).toBe(false);
    });

    it('returns false when there are pending installs', () => {
      const itemCounts = { willBeInstalled: 1, installedThisRun: 0, alreadyPresent: 4, needsAttention: 0, skipped: 0 };
      expect(isAllAlreadyPresent(itemCounts)).toBe(false);
    });

    it('returns false when there are failures', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 0, alreadyPresent: 4, needsAttention: 1, skipped: 0 };
      expect(isAllAlreadyPresent(itemCounts)).toBe(false);
    });

    it('returns false when no apps are already present', () => {
      const itemCounts = { willBeInstalled: 0, installedThisRun: 0, alreadyPresent: 0, needsAttention: 0, skipped: 0 };
      expect(isAllAlreadyPresent(itemCounts)).toBe(false);
    });
  });

  // Semantic correctness tests that would have caught the original bug
  describe('Semantic correctness - Preview vs Apply', () => {
    it('Preview scenario: 61 present + 1 missing shows willBeInstalled=1, alreadyPresent=61', () => {
      const items: ApplyItem[] = [
        ...Array(61).fill(null).map((_, i) => ({ 
          id: `Present.App${i}`, 
          driver: 'winget', 
          status: 'skipped' as const, 
          reason: 'already_installed' 
        })),
        { id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];

      const groups = categorizeApplyItems(items);
      const counts = countCategorizedItems(groups);

      expect(counts.willBeInstalled).toBe(1);
      expect(counts.alreadyPresent).toBe(61);
      expect(counts.installedThisRun).toBe(0);  // CRITICAL: must be 0 in preview
      expect(counts.needsAttention).toBe(0);
    });

    it('Apply scenario: 61 present + 1 installed shows installedThisRun=1, alreadyPresent=61', () => {
      const items: ApplyItem[] = [
        ...Array(61).fill(null).map((_, i) => ({ 
          id: `Present.App${i}`, 
          driver: 'winget', 
          status: 'skipped' as const, 
          reason: 'already_installed' 
        })),
        { id: 'Notepad++.Notepad++', driver: 'winget', status: 'ok', reason: 'installed' },
      ];

      const groups = categorizeApplyItems(items);
      const counts = countCategorizedItems(groups);

      expect(counts.installedThisRun).toBe(1);
      expect(counts.alreadyPresent).toBe(61);
      expect(counts.willBeInstalled).toBe(0);  // CRITICAL: must be 0 after apply
      expect(counts.needsAttention).toBe(0);
    });

    it('Preview NEVER shows "Installed" category (installedThisRun must be 0)', () => {
      // Simulate preview result with would_install items
      const items: ApplyItem[] = [
        { id: 'Missing.App', driver: 'winget', status: 'ok', reason: 'would_install' },
        { id: 'Present.App', driver: 'winget', status: 'skipped', reason: 'already_installed' },
      ];

      const groups = categorizeApplyItems(items);
      const counts = countCategorizedItems(groups);

      // In preview, would_install should NOT count as installedThisRun
      expect(counts.installedThisRun).toBe(0);
      expect(counts.willBeInstalled).toBe(1);
    });
  });

  describe('parseApplyProgressLine', () => {
    it('parses [OK] with already installed', () => {
      const result = parseApplyProgressLine('[OK] Discord.Discord (driver: winget) - already installed');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'OK', statusKey: 'present' });
    });

    it('parses [OK] with installed successfully', () => {
      const result = parseApplyProgressLine('[OK] Discord.Discord (driver: winget) - Installed successfully');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'OK', statusKey: 'present' });
    });

    it('parses [INSTALL] line', () => {
      const result = parseApplyProgressLine('[INSTALL] Discord.Discord (driver: winget)');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Processing', statusKey: 'installing' });
    });

    it('parses [PLAN] line', () => {
      const result = parseApplyProgressLine('[PLAN] Discord.Discord - to install (driver: winget)');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'To install', statusKey: 'to_install' });
    });

    it('parses [ACTION] Installing line', () => {
      const result = parseApplyProgressLine('[ACTION] Installing Discord.Discord via winget');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Processing', statusKey: 'installing' });
    });

    it('parses [SKIP] with already installed as OK (not Skipped)', () => {
      const result = parseApplyProgressLine('[SKIP] Discord.Discord - already installed');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'OK', statusKey: 'present' });
    });

    it('parses [SKIP] with filtered', () => {
      const result = parseApplyProgressLine('[SKIP] Discord.Discord - filtered');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Skipped', statusKey: 'skipped' });
    });

    it('parses [FAIL] line', () => {
      const result = parseApplyProgressLine('[FAIL] Discord.Discord - installation error');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Failed', statusKey: 'failed' });
    });

    it('parses [MISSING] line as to_install (for verify phase)', () => {
      const result = parseApplyProgressLine('[MISSING] Discord.Discord (driver: winget)');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Missing', statusKey: 'to_install' });
    });

    it('parses [VERSION] line', () => {
      const result = parseApplyProgressLine('[VERSION] Discord.Discord - expected 1.0, got 0.9');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Version mismatch', statusKey: 'failed' });
    });

    it('parses winget Found line', () => {
      const result = parseApplyProgressLine('Found Discord [Discord.Discord]');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Processing', statusKey: 'installing' });
    });

    it('parses winget Installing line', () => {
      const result = parseApplyProgressLine('Installing Discord [Discord.Discord]...');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Processing', statusKey: 'installing' });
    });

    it('parses winget Successfully installed line', () => {
      const result = parseApplyProgressLine('Successfully installed Discord [Discord.Discord]');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Installed', statusKey: 'installed' });
    });

    it('returns null for non-progress lines', () => {
      expect(parseApplyProgressLine('')).toBeNull();
      expect(parseApplyProgressLine('Some random log line')).toBeNull();
      expect(parseApplyProgressLine('[endstate] Apply: starting')).toBeNull();
    });

    it('handles null/undefined input', () => {
      expect(parseApplyProgressLine(null as any)).toBeNull();
      expect(parseApplyProgressLine(undefined as any)).toBeNull();
    });
  });

  describe('StreamingLineBuffer', () => {
    it('returns complete lines and buffers partial', () => {
      const buffer = new StreamingLineBuffer();
      
      const lines1 = buffer.append('Hello\nWorld\nPartial');
      expect(lines1).toEqual(['Hello', 'World']);
      expect(buffer.getRemaining()).toBe('Partial');
    });

    it('handles Windows line endings (CRLF)', () => {
      const buffer = new StreamingLineBuffer();
      
      const lines = buffer.append('Hello\r\nWorld\r\n');
      expect(lines).toEqual(['Hello', 'World']);
    });

    it('accumulates partial lines across calls', () => {
      const buffer = new StreamingLineBuffer();
      
      const lines1 = buffer.append('Hel');
      expect(lines1).toEqual([]);
      
      const lines2 = buffer.append('lo\nWorld');
      expect(lines2).toEqual(['Hello']);
      expect(buffer.getRemaining()).toBe('World');
    });

    it('clears buffer', () => {
      const buffer = new StreamingLineBuffer();
      buffer.append('Partial');
      expect(buffer.getRemaining()).toBe('Partial');
      
      buffer.clear();
      expect(buffer.getRemaining()).toBe('');
    });

    it('handles empty input', () => {
      const buffer = new StreamingLineBuffer();
      const lines = buffer.append('');
      expect(lines).toEqual([]);
    });

    it('handles multiple newlines', () => {
      const buffer = new StreamingLineBuffer();
      const lines = buffer.append('A\n\nB\n');
      expect(lines).toEqual(['A', '', 'B']);
    });
  });

  describe('reasonToAction', () => {
    it('maps failed status to Failed with statusKey', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed', reason: 'install_failed' };
      const result = reasonToAction(item);
      expect(result.action).toBe('Failed');
      expect(result.statusKey).toBe('failed');
    });

    it('maps user_denied to Cancelled with statusKey', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'user_denied' };
      const result = reasonToAction(item);
      expect(result.action).toBe('Cancelled');
      expect(result.statusKey).toBe('cancelled');
    });

    it('maps installed to Installed with statusKey', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'installed' };
      const result = reasonToAction(item);
      expect(result.action).toBe('Installed');
      expect(result.statusKey).toBe('installed');
    });

    it('maps already_installed to OK with statusKey', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'already_installed' };
      const result = reasonToAction(item);
      expect(result.action).toBe('OK');
      expect(result.statusKey).toBe('present');
    });

    it('maps would_install to To install with statusKey', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'would_install' };
      const result = reasonToAction(item);
      expect(result.action).toBe('To install');
      expect(result.statusKey).toBe('to_install');
    });

    it('maps skipped status to Skipped with statusKey', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'filtered' };
      const result = reasonToAction(item);
      expect(result.action).toBe('Skipped');
      expect(result.statusKey).toBe('skipped');
    });
  });

  describe('getFailedItemMessage', () => {
    it('returns item message when present', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed', message: 'Network error' };
      expect(getFailedItemMessage(item)).toBe('Network error');
    });

    it('returns fallback when message is null', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed' };
      expect(getFailedItemMessage(item)).toBe('Install failed (no details returned)');
    });

    it('returns fallback when message is empty string', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed', message: '' };
      expect(getFailedItemMessage(item)).toBe('Install failed (no details returned)');
    });

    it('returns fallback when message is whitespace only', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed', message: '   ' };
      expect(getFailedItemMessage(item)).toBe('Install failed (no details returned)');
    });
  });

  describe('reconcileLiveActivity', () => {
    it('updates Working entry to Failed when envelope shows failure', () => {
      const liveEvents: AppEvent[] = [
        { app: 'Notepad++.Notepad++', action: 'Processing', timestamp: 1000 },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'Notepad++.Notepad++', driver: 'winget', status: 'failed', reason: 'install_failed' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('Notepad++.Notepad++');
      expect(result[0].action).toBe('Failed');
      // Should NOT be 'Processing' or 'Working'
      expect(result[0].action).not.toBe('Processing');
    });

    it('preserves order from live events when reconciling', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Processing', timestamp: 1000 },
        { app: 'App2', action: 'Processing', timestamp: 2000 },
        { app: 'App3', action: 'Processing', timestamp: 3000 },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'failed', reason: 'install_failed' },
        { id: 'App3', driver: 'winget', status: 'skipped', reason: 'already_installed' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(3);
      expect(result[0].app).toBe('App1');
      expect(result[0].action).toBe('Installed');
      expect(result[1].app).toBe('App2');
      expect(result[1].action).toBe('Failed');
      expect(result[2].app).toBe('App3');
      expect(result[2].action).toBe('OK');
    });

    it('adds envelope items not in live events', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Installed', timestamp: 1000 },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'skipped', reason: 'already_installed' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(2);
      expect(result[0].app).toBe('App1');
      expect(result[1].app).toBe('App2');
      expect(result[1].action).toBe('OK');
    });

    it('handles empty live events', () => {
      const liveEvents: AppEvent[] = [];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('App1');
      expect(result[0].action).toBe('Installed');
    });

    it('handles empty envelope items', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Processing', timestamp: 1000 },
      ];
      const envelopeItems: ApplyItem[] = [];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('App1');
      expect(result[0].action).toBe('Processing'); // Not reconciled, stays as-is
    });

    it('handles user_denied as Cancelled', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Processing', timestamp: 1000 },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'skipped', reason: 'user_denied' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Cancelled');
    });

    it('CRITICAL: Working entry MUST become Failed when envelope shows failure', () => {
      // This is the exact bug scenario reported by the user
      const liveEvents: AppEvent[] = [
        { app: 'Notepad++.Notepad++', action: 'Processing', timestamp: 1000 },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'Notepad++.Notepad++', driver: 'winget', status: 'failed', reason: 'install_failed', message: null as unknown as string },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      // The bug was: live activity showed "Working..." even after engine reported failure
      // After fix: must show "Failed"
      expect(result[0].action).toBe('Failed');
      expect(result[0].action).not.toBe('Processing');
      expect(result[0].action).not.toBe('Working');
    });

    it('preserves phase from existing live event', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Processing', timestamp: 1000, phase: 'verify' },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].phase).toBe('verify');
    });

    it('preserves reason from envelope item over existing event', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Processing', timestamp: 1000, reason: 'old_reason' },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'skipped', reason: 'already_installed' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('already_installed');
    });

    it('falls back to existing reason if envelope has no reason', () => {
      const liveEvents: AppEvent[] = [
        { app: 'App1', action: 'Processing', timestamp: 1000, reason: 'existing_reason' },
      ];
      const envelopeItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok' },
      ];

      const result = reconcileLiveActivity(liveEvents, envelopeItems);

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('existing_reason');
    });
  });

  describe('normalizeApplyStatus - user_denied', () => {
    it('maps user_denied to skipped category', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'user_denied' };
      expect(normalizeApplyStatus(item)).toBe('skipped');
    });
  });

  describe('Live Activity Banner Label Mapping', () => {
    /**
     * Tests for the banner label mapping logic used in App.tsx
     * The banner must show in-progress action during streaming, not final disposition
     */
    
    // Helper function that mirrors the logic in App.tsx handleApplyFromOverview
    function getBannerLabel(action: string): string {
      const isFinalAction = ['Installed', 'Skipped', 'Failed', 'OK', 'Cancelled'].includes(action);
      const friendlyAction = action === 'OK' ? 'Already present' :
                             action === 'Processing' ? 'Installing' :
                             action === 'To install' ? 'Evaluating' :
                             isFinalAction ? action :
                             'Working on';
      return friendlyAction;
    }

    it('Processing action shows "Installing" not "Working..."', () => {
      expect(getBannerLabel('Processing')).toBe('Installing');
      expect(getBannerLabel('Processing')).not.toBe('Working…');
      expect(getBannerLabel('Processing')).not.toBe('Working...');
    });

    it('To install action shows "Evaluating" during preview', () => {
      expect(getBannerLabel('To install')).toBe('Evaluating');
    });

    it('OK action shows "Already present"', () => {
      expect(getBannerLabel('OK')).toBe('Already present');
    });

    it('Final actions pass through unchanged', () => {
      expect(getBannerLabel('Installed')).toBe('Installed');
      expect(getBannerLabel('Skipped')).toBe('Skipped');
      expect(getBannerLabel('Failed')).toBe('Failed');
      expect(getBannerLabel('Cancelled')).toBe('Cancelled');
    });

    it('Unknown actions show "Working on"', () => {
      expect(getBannerLabel('SomeUnknownAction')).toBe('Working on');
    });

    it('CRITICAL: In-progress items must NOT show final disposition labels', () => {
      // This is the core bug fix - during streaming, we should never show
      // "Skipped: <app>" while subtext says "Working..."
      // Processing = in-progress, should show "Installing"
      const processingLabel = getBannerLabel('Processing');
      expect(processingLabel).not.toBe('Skipped');
      expect(processingLabel).not.toBe('Installed');
      expect(processingLabel).not.toBe('Failed');
      expect(processingLabel).toBe('Installing');
    });
  });

  describe('Setup Details Filter Logic', () => {
    /**
     * Tests for the filter logic used in Overview Setup Details modal
     */
    interface AppEvent {
      app: string;
      action: string;
    }

    function filterEvents(events: AppEvent[], filter: string | null): AppEvent[] {
      if (!filter) return events;
      return events.filter(e => {
        if (filter === 'OK') return e.action === 'OK';
        if (filter === 'To install') return e.action === 'To install' || e.action === 'Missing';
        return e.action === filter;
      });
    }

    const testEvents: AppEvent[] = [
      { app: 'App1', action: 'Installed' },
      { app: 'App2', action: 'OK' },
      { app: 'App3', action: 'Failed' },
      { app: 'App4', action: 'Skipped' },
      { app: 'App5', action: 'To install' },
      { app: 'App6', action: 'Missing' },
    ];

    it('null filter returns all events', () => {
      const result = filterEvents(testEvents, null);
      expect(result).toHaveLength(6);
    });

    it('Installed filter returns only Installed events', () => {
      const result = filterEvents(testEvents, 'Installed');
      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('App1');
    });

    it('OK filter returns only OK events', () => {
      const result = filterEvents(testEvents, 'OK');
      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('App2');
    });

    it('Failed filter returns only Failed events', () => {
      const result = filterEvents(testEvents, 'Failed');
      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('App3');
    });

    it('Skipped filter returns only Skipped events', () => {
      const result = filterEvents(testEvents, 'Skipped');
      expect(result).toHaveLength(1);
      expect(result[0].app).toBe('App4');
    });

    it('To install filter returns To install AND Missing events', () => {
      const result = filterEvents(testEvents, 'To install');
      expect(result).toHaveLength(2);
      expect(result.map(e => e.app)).toContain('App5');
      expect(result.map(e => e.app)).toContain('App6');
    });
  });

  describe('RESTORE_STATUS_MAP', () => {
    it('maps all expected restore statuses', () => {
      const keys: RestoreStatusKey[] = ['restoring', 'restored', 'skipped_up_to_date', 'skipped_missing_source', 'failed'];
      for (const key of keys) {
        expect(RESTORE_STATUS_MAP[key]).toBeDefined();
        expect(RESTORE_STATUS_MAP[key].shortLabel).toBeTruthy();
        expect(RESTORE_STATUS_MAP[key].longLabel).toBeTruthy();
        expect(RESTORE_STATUS_MAP[key].color).toBeTruthy();
      }
    });

    it('restored maps to success color', () => {
      expect(RESTORE_STATUS_MAP.restored.color).toBe('success');
    });

    it('failed maps to error color', () => {
      expect(RESTORE_STATUS_MAP.failed.color).toBe('error');
    });

    it('skipped_up_to_date maps to muted color', () => {
      expect(RESTORE_STATUS_MAP.skipped_up_to_date.color).toBe('muted');
    });

    it('skipped_missing_source maps to warn color', () => {
      expect(RESTORE_STATUS_MAP.skipped_missing_source.color).toBe('warn');
    });

    it('restoring maps to info color', () => {
      expect(RESTORE_STATUS_MAP.restoring.color).toBe('info');
    });
  });

  describe('getRestoreUiStatus', () => {
    it('returns correct config for each restore status', () => {
      expect(getRestoreUiStatus('restored').shortLabel).toBe('RESTORED');
      expect(getRestoreUiStatus('restoring').shortLabel).toBe('RESTORING');
      expect(getRestoreUiStatus('skipped_up_to_date').shortLabel).toBe('UP TO DATE');
      expect(getRestoreUiStatus('skipped_missing_source').shortLabel).toBe('MISSING');
      expect(getRestoreUiStatus('failed').shortLabel).toBe('FAILED');
    });

    it('falls back to failed for unknown status', () => {
      const result = getRestoreUiStatus('unknown_status' as RestoreStatusKey);
      expect(result.shortLabel).toBe('FAILED');
      expect(result.color).toBe('error');
    });
  });

  describe('deriveCountersFromEvents', () => {
    it('returns all zeros for empty events', () => {
      expect(deriveCountersFromEvents([])).toEqual({
        installed: 0, alreadyPresent: 0, skipped: 0, failed: 0,
        configsRestored: 0, configsSkipped: 0, configsFailed: 0,
      });
    });

    it('counts final statuses correctly', () => {
      const events: AppEvent[] = [
        { app: 'git', action: 'Installed', statusKey: 'installed' },
        { app: 'node', action: 'OK', statusKey: 'present' },
        { app: 'ruby', action: 'Skipped', statusKey: 'skipped' },
        { app: 'python', action: 'Failed', statusKey: 'failed' },
        { app: 'vim', action: 'OK', statusKey: 'present' },
      ];
      const counters = deriveCountersFromEvents(events);
      expect(counters.installed).toBe(1);
      expect(counters.alreadyPresent).toBe(2);
      expect(counters.skipped).toBe(1);
      expect(counters.failed).toBe(1);
    });

    it('skips phase header events', () => {
      const events: AppEvent[] = [
        { app: '── APPLY ──', action: '', phase: 'apply' },
        { app: 'git', action: 'Installed', statusKey: 'installed' },
        { app: '── VERIFY ──', action: '', phase: 'verify' },
        { app: 'git', action: 'OK', statusKey: 'present' },
      ];
      const counters = deriveCountersFromEvents(events);
      expect(counters.installed).toBe(1);
      expect(counters.alreadyPresent).toBe(1);
    });

    it('skips intermediate statuses (installing, to_install)', () => {
      const events: AppEvent[] = [
        { app: 'git', action: 'Installing', statusKey: 'installing' },
        { app: 'node', action: 'To install', statusKey: 'to_install' },
        { app: 'vim', action: 'Installed', statusKey: 'installed' },
      ];
      const counters = deriveCountersFromEvents(events);
      expect(counters.installed).toBe(1);
      expect(counters.alreadyPresent).toBe(0);
    });

    it('counts restore events separately via gear prefix', () => {
      const events: AppEvent[] = [
        { app: 'git', action: 'Installed', statusKey: 'installed' },
        { app: '\u2699 vscode/settings', action: 'RESTORED', statusKey: 'installed', phase: 'apply' },
        { app: '\u2699 git/config', action: 'UP TO DATE', statusKey: 'skipped', phase: 'apply' },
        { app: '\u2699 terminal/config', action: 'FAILED', statusKey: 'failed', phase: 'apply' },
      ];
      const counters = deriveCountersFromEvents(events);
      expect(counters.installed).toBe(1);
      expect(counters.configsRestored).toBe(1);
      expect(counters.configsSkipped).toBe(1);
      expect(counters.configsFailed).toBe(1);
    });

    it('skips events without statusKey', () => {
      const events: AppEvent[] = [
        { app: 'git', action: 'Unknown' },
        { app: 'node', action: 'Installed', statusKey: 'installed' },
      ];
      const counters = deriveCountersFromEvents(events);
      expect(counters.installed).toBe(1);
      expect(counters.alreadyPresent).toBe(0);
    });
  });
});
