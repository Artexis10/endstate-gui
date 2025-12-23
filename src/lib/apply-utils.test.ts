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
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Already installed' });
    });

    it('parses [OK] with installed successfully', () => {
      const result = parseApplyProgressLine('[OK] Discord.Discord (driver: winget) - Installed successfully');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Installed' });
    });

    it('parses [INSTALL] line', () => {
      const result = parseApplyProgressLine('[INSTALL] Discord.Discord (driver: winget)');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Installing' });
    });

    it('parses [PLAN] line', () => {
      const result = parseApplyProgressLine('[PLAN] Discord.Discord - would install (driver: winget)');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Would install' });
    });

    it('parses [ACTION] Installing line', () => {
      const result = parseApplyProgressLine('[ACTION] Installing Discord.Discord via winget');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Installing' });
    });

    it('parses [SKIP] with already installed', () => {
      const result = parseApplyProgressLine('[SKIP] Discord.Discord - already installed');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Already installed' });
    });

    it('parses [SKIP] with filtered', () => {
      const result = parseApplyProgressLine('[SKIP] Discord.Discord - filtered');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Skipped' });
    });

    it('parses [FAIL] line', () => {
      const result = parseApplyProgressLine('[FAIL] Discord.Discord - installation error');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Failed' });
    });

    it('parses [MISSING] line', () => {
      const result = parseApplyProgressLine('[MISSING] Discord.Discord (driver: winget)');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Missing' });
    });

    it('parses [VERSION] line', () => {
      const result = parseApplyProgressLine('[VERSION] Discord.Discord - expected 1.0, got 0.9');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Version mismatch' });
    });

    it('parses winget Found line', () => {
      const result = parseApplyProgressLine('Found Discord [Discord.Discord]');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Checking' });
    });

    it('parses winget Installing line', () => {
      const result = parseApplyProgressLine('Installing Discord [Discord.Discord]...');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Installing' });
    });

    it('parses winget Successfully installed line', () => {
      const result = parseApplyProgressLine('Successfully installed Discord [Discord.Discord]');
      expect(result).toEqual({ app: 'Discord.Discord', action: 'Installed' });
    });

    it('returns null for non-progress lines', () => {
      expect(parseApplyProgressLine('')).toBeNull();
      expect(parseApplyProgressLine('Some random log line')).toBeNull();
      expect(parseApplyProgressLine('[autosuite] Apply: starting')).toBeNull();
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
});
