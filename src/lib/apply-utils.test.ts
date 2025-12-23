import { describe, it, expect } from 'vitest';
import {
  normalizeApplyStatus,
  categorizeApplyItems,
  countCategorizedItems,
  isApplyReady,
  isAllUpToDate,
  parseApplyProgressLine,
  StreamingLineBuffer,
} from './apply-utils';
import type { ApplyItem, ApplyCounts } from '../types';

describe('apply-utils', () => {
  describe('normalizeApplyStatus', () => {
    it('maps status=ok, reason=installed to installed', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'installed' };
      expect(normalizeApplyStatus(item)).toBe('installed');
    });

    it('maps status=ok, reason=would_install to installed', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'would_install' };
      expect(normalizeApplyStatus(item)).toBe('installed');
    });

    it('maps status=ok without reason to installed', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok' };
      expect(normalizeApplyStatus(item)).toBe('installed');
    });

    it('maps status=skipped, reason=already_installed to alreadyInstalled', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'already_installed' };
      expect(normalizeApplyStatus(item)).toBe('alreadyInstalled');
    });

    it('maps status=skipped, reason=filtered to skipped', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped', reason: 'filtered' };
      expect(normalizeApplyStatus(item)).toBe('skipped');
    });

    it('maps status=skipped without reason to skipped', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'skipped' };
      expect(normalizeApplyStatus(item)).toBe('skipped');
    });

    it('maps status=failed to failed', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'failed', reason: 'install_failed' };
      expect(normalizeApplyStatus(item)).toBe('failed');
    });

    it('maps reason=install_failed to failed regardless of status', () => {
      const item: ApplyItem = { id: 'App.Id', driver: 'winget', status: 'ok', reason: 'install_failed' };
      expect(normalizeApplyStatus(item)).toBe('failed');
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
      ];

      const groups = categorizeApplyItems(items);

      expect(groups.installed.winget).toHaveLength(1);
      expect(groups.installed.winget[0].id).toBe('App1');
      expect(groups.installed.msstore).toHaveLength(1);
      expect(groups.installed.msstore[0].id).toBe('App3');
      expect(groups.alreadyInstalled.winget).toHaveLength(1);
      expect(groups.alreadyInstalled.winget[0].id).toBe('App2');
      expect(groups.failed.winget).toHaveLength(1);
      expect(groups.failed.winget[0].id).toBe('App4');
      expect(groups.skipped.winget).toHaveLength(1);
      expect(groups.skipped.winget[0].id).toBe('App5');
    });

    it('handles empty items array', () => {
      const groups = categorizeApplyItems([]);
      expect(groups.installed).toEqual({});
      expect(groups.alreadyInstalled).toEqual({});
      expect(groups.skipped).toEqual({});
      expect(groups.failed).toEqual({});
    });

    it('uses "unknown" driver when driver is missing', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: '', status: 'ok', reason: 'installed' },
      ];
      const groups = categorizeApplyItems(items);
      expect(groups.installed.unknown).toHaveLength(1);
    });
  });

  describe('countCategorizedItems', () => {
    it('counts items in each category', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App3', driver: 'winget', status: 'skipped', reason: 'already_installed' },
        { id: 'App4', driver: 'winget', status: 'failed' },
      ];

      const groups = categorizeApplyItems(items);
      const counts = countCategorizedItems(groups);

      expect(counts.installed).toBe(2);
      expect(counts.alreadyInstalled).toBe(1);
      expect(counts.skipped).toBe(0);
      expect(counts.failed).toBe(1);
    });
  });

  describe('isApplyReady', () => {
    it('returns true when no failures', () => {
      const counts: ApplyCounts = { total: 5, installed: 2, alreadyInstalled: 3, skippedFiltered: 0, failed: 0 };
      const itemCounts = { installed: 2, alreadyInstalled: 3, skipped: 0, failed: 0 };
      expect(isApplyReady(counts, itemCounts)).toBe(true);
    });

    it('returns false when envelope counts has failures', () => {
      const counts: ApplyCounts = { total: 5, installed: 2, alreadyInstalled: 2, skippedFiltered: 0, failed: 1 };
      const itemCounts = { installed: 2, alreadyInstalled: 2, skipped: 0, failed: 1 };
      expect(isApplyReady(counts, itemCounts)).toBe(false);
    });

    it('returns false when item counts has failures', () => {
      const counts: ApplyCounts = { total: 5, installed: 2, alreadyInstalled: 2, skippedFiltered: 0, failed: 0 };
      const itemCounts = { installed: 2, alreadyInstalled: 2, skipped: 0, failed: 1 };
      expect(isApplyReady(counts, itemCounts)).toBe(false);
    });
  });

  describe('isAllUpToDate', () => {
    it('returns true when all apps already installed and none newly installed', () => {
      const counts: ApplyCounts = { total: 5, installed: 0, alreadyInstalled: 5, skippedFiltered: 0, failed: 0 };
      const itemCounts = { installed: 0, alreadyInstalled: 5, skipped: 0, failed: 0 };
      expect(isAllUpToDate(counts, itemCounts)).toBe(true);
    });

    it('returns false when some apps were newly installed', () => {
      const counts: ApplyCounts = { total: 5, installed: 2, alreadyInstalled: 3, skippedFiltered: 0, failed: 0 };
      const itemCounts = { installed: 2, alreadyInstalled: 3, skipped: 0, failed: 0 };
      expect(isAllUpToDate(counts, itemCounts)).toBe(false);
    });

    it('returns false when there are failures', () => {
      const counts: ApplyCounts = { total: 5, installed: 0, alreadyInstalled: 4, skippedFiltered: 0, failed: 1 };
      const itemCounts = { installed: 0, alreadyInstalled: 4, skipped: 0, failed: 1 };
      expect(isAllUpToDate(counts, itemCounts)).toBe(false);
    });

    it('returns false when no apps are already installed', () => {
      const counts: ApplyCounts = { total: 0, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 };
      const itemCounts = { installed: 0, alreadyInstalled: 0, skipped: 0, failed: 0 };
      expect(isAllUpToDate(counts, itemCounts)).toBe(false);
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
