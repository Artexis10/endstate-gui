import { describe, it, expect } from 'vitest';
import { parseApplyProgressLine } from './apply-utils';

/**
 * REGRESSION TEST: parseApplyProgressLine must distinguish between
 * "skipped because already installed" (OK/Already present) and
 * "skipped for other reasons" (Skipped).
 * 
 * This fixes the bug where live activity showed "SKIPPED" for apps
 * that were already present, while the modal showed "Already present".
 */
describe('parseApplyProgressLine - Already Present vs Skipped', () => {
  describe('SKIP with already installed reason => OK (Already present)', () => {
    it('maps [SKIP] with "already installed" to OK', () => {
      const line = '[SKIP] Git.Git - already installed';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('Git.Git');
      expect(result?.action).toBe('OK');
    });

    it('maps [SKIP] with "already present" to OK', () => {
      const line = '[SKIP] VSCode - already present';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('VSCode');
      expect(result?.action).toBe('OK');
    });

    it('maps [SKIP] with "no action" to OK', () => {
      const line = '[SKIP] Chrome - no action needed';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('Chrome');
      expect(result?.action).toBe('OK');
    });

    it('handles case-insensitive matching', () => {
      const line = '[SKIP] App.Id - Already Installed';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.action).toBe('OK');
    });
  });

  describe('SKIP with other reasons => Skipped', () => {
    it('maps [SKIP] with "filtered" to Skipped', () => {
      const line = '[SKIP] SystemApp - filtered by policy';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('SystemApp');
      expect(result?.action).toBe('Skipped');
    });

    it('maps [SKIP] with "excluded" to Skipped', () => {
      const line = '[SKIP] BlockedApp - excluded';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('BlockedApp');
      expect(result?.action).toBe('Skipped');
    });

    it('maps [SKIP] without reason to Skipped', () => {
      const line = '[SKIP] UnknownApp';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('UnknownApp');
      expect(result?.action).toBe('Skipped');
    });
  });

  describe('OK tag => OK (Already present)', () => {
    it('maps [OK] to OK', () => {
      const line = '[OK] Git.Git (driver: winget) - verified';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('Git.Git');
      expect(result?.action).toBe('OK');
    });
  });

  describe('Other actions remain unchanged', () => {
    it('maps [PLAN] to To install', () => {
      const line = '[PLAN] NewApp';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('NewApp');
      expect(result?.action).toBe('To install');
    });

    it('maps [INSTALL] to Processing', () => {
      const line = '[INSTALL] NewApp (driver: winget)';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('NewApp');
      expect(result?.action).toBe('Processing');
    });

    it('maps [FAIL] to Failed', () => {
      const line = '[FAIL] BrokenApp - error message';
      const result = parseApplyProgressLine(line);
      
      expect(result).not.toBeNull();
      expect(result?.app).toBe('BrokenApp');
      expect(result?.action).toBe('Failed');
    });
  });
});
