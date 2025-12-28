import { describe, it, expect } from 'vitest';
import { 
  parseApplyProgressLine, 
  engineStatusToStatusKey, 
  itemEventToAppEvent,
  UI_STATUS_MAP,
} from './apply-utils';
import type { ItemEvent } from './streaming-events';

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

/**
 * Tests for NDJSON streaming event status mapping.
 * These functions map engine streaming statuses to UI StatusKeys.
 */
describe('engineStatusToStatusKey - Streaming Status Mapping', () => {
  describe('Engine status to UI StatusKey mapping', () => {
    it('maps "present" to "already_present"', () => {
      expect(engineStatusToStatusKey('present')).toBe('already_present');
    });

    it('maps "to_install" to "to_install"', () => {
      expect(engineStatusToStatusKey('to_install')).toBe('to_install');
    });

    it('maps "installing" to "installing"', () => {
      expect(engineStatusToStatusKey('installing')).toBe('installing');
    });

    it('maps "installed" to "installed"', () => {
      expect(engineStatusToStatusKey('installed')).toBe('installed');
    });

    it('maps "skipped" to "skipped"', () => {
      expect(engineStatusToStatusKey('skipped')).toBe('skipped');
    });

    it('maps "failed" to "failed"', () => {
      expect(engineStatusToStatusKey('failed')).toBe('failed');
    });

    it('maps unknown status to "skipped" as fallback', () => {
      expect(engineStatusToStatusKey('unknown' as any)).toBe('skipped');
    });
  });

  describe('UI_STATUS_MAP color consistency', () => {
    it('present/already_present uses green (success)', () => {
      expect(UI_STATUS_MAP.already_present.color).toBe('success');
    });

    it('to_install uses blue (info)', () => {
      expect(UI_STATUS_MAP.to_install.color).toBe('info');
    });

    it('installing uses blue (info)', () => {
      expect(UI_STATUS_MAP.installing.color).toBe('info');
    });

    it('installed uses green (success)', () => {
      expect(UI_STATUS_MAP.installed.color).toBe('success');
    });

    it('skipped uses yellow (warn)', () => {
      expect(UI_STATUS_MAP.skipped.color).toBe('warn');
    });

    it('failed uses red (error)', () => {
      expect(UI_STATUS_MAP.failed.color).toBe('error');
    });
  });

  describe('UI_STATUS_MAP label consistency', () => {
    it('already_present has correct labels', () => {
      expect(UI_STATUS_MAP.already_present.shortLabel).toBe('PRESENT');
      expect(UI_STATUS_MAP.already_present.longLabel).toBe('Already present');
    });

    it('to_install has correct labels', () => {
      expect(UI_STATUS_MAP.to_install.shortLabel).toBe('TO INSTALL');
      expect(UI_STATUS_MAP.to_install.longLabel).toBe('To install');
    });

    it('installing has correct labels', () => {
      expect(UI_STATUS_MAP.installing.shortLabel).toBe('INSTALLING');
      expect(UI_STATUS_MAP.installing.longLabel).toBe('Installing…');
    });

    it('installed has correct labels', () => {
      expect(UI_STATUS_MAP.installed.shortLabel).toBe('INSTALLED');
      expect(UI_STATUS_MAP.installed.longLabel).toBe('Installed');
    });

    it('skipped has correct labels', () => {
      expect(UI_STATUS_MAP.skipped.shortLabel).toBe('SKIPPED');
      expect(UI_STATUS_MAP.skipped.longLabel).toBe('Skipped');
    });

    it('failed has correct labels', () => {
      expect(UI_STATUS_MAP.failed.shortLabel).toBe('FAILED');
      expect(UI_STATUS_MAP.failed.longLabel).toBe('Failed');
    });
  });
});

describe('itemEventToAppEvent - Streaming Event Conversion', () => {
  it('converts ItemEvent to AppEvent with correct fields', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'Notepad++.Notepad++',
      driver: 'winget',
      status: 'installing',
      reason: null,
      message: 'Installing via winget',
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent, 'apply');

    expect(appEvent.app).toBe('Notepad++.Notepad++');
    expect(appEvent.action).toBe('Installing via winget');
    expect(appEvent.statusKey).toBe('installing');
    expect(appEvent.phase).toBe('apply');
    expect(appEvent.timestamp).toBeDefined();
  });

  it('uses status as action when message is not provided', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'App.Id',
      driver: 'winget',
      status: 'installed',
      reason: null,
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent);

    expect(appEvent.action).toBe('installed');
  });

  it('maps "present" status to "already_present" statusKey', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'App.Id',
      driver: 'winget',
      status: 'present',
      reason: 'already_installed',
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent, 'apply');

    expect(appEvent.statusKey).toBe('already_present');
  });

  it('sets phase to undefined for "plan" phase (not UI-relevant)', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'App.Id',
      driver: 'winget',
      status: 'to_install',
      reason: null,
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent, 'plan');

    expect(appEvent.phase).toBeUndefined();
  });

  it('correctly maps verify phase', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'App.Id',
      driver: 'winget',
      status: 'present',
      reason: null,
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent, 'verify');

    expect(appEvent.phase).toBe('verify');
  });
});
