import { describe, it, expect } from 'vitest';
import { 
  parseApplyProgressLine, 
  engineStatusToStatusKey, 
  itemEventToAppEvent,
  UI_STATUS_MAP,
  PHASE_STATUS_MAP,
  getPhaseAwareStatus,
  getPhaseAwareStatusForEvent,
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
    it('maps "present" to "present"', () => {
      expect(engineStatusToStatusKey('present')).toBe('present');
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
    it('present uses green (success)', () => {
      expect(UI_STATUS_MAP.present.color).toBe('success');
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
    it('present has correct labels', () => {
      expect(UI_STATUS_MAP.present.shortLabel).toBe('PRESENT');
      expect(UI_STATUS_MAP.present.longLabel).toBe('Already present');
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

  it('maps "present" status to "present" statusKey', () => {
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

    expect(appEvent.statusKey).toBe('present');
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

/**
 * Tests for phase-aware UI status mapping.
 * Different phases use different language for the same underlying status.
 */
describe('PHASE_STATUS_MAP - Phase-Aware Status Labels', () => {
  describe('Capture phase uses observational language', () => {
    it('present shows as "Detected" (not "Already present")', () => {
      const status = PHASE_STATUS_MAP.capture.present;
      expect(status?.shortLabel).toBe('DETECTED');
      expect(status?.longLabel).toBe('Detected');
      expect(status?.color).toBe('detected');
    });

    it('installed shows as "Detected"', () => {
      const status = PHASE_STATUS_MAP.capture.installed;
      expect(status?.shortLabel).toBe('DETECTED');
      expect(status?.longLabel).toBe('Detected');
    });

    it('to_install shows as "Not found" (not "To install")', () => {
      const status = PHASE_STATUS_MAP.capture.to_install;
      expect(status?.shortLabel).toBe('NOT FOUND');
      expect(status?.longLabel).toBe('Not found');
      expect(status?.color).toBe('muted');
    });

    it('skipped shows as "Excluded" (not "Skipped")', () => {
      const status = PHASE_STATUS_MAP.capture.skipped;
      expect(status?.shortLabel).toBe('EXCLUDED');
      expect(status?.longLabel).toBe('Excluded');
    });

    it('installing shows as "Scanning"', () => {
      const status = PHASE_STATUS_MAP.capture.installing;
      expect(status?.shortLabel).toBe('SCANNING');
      expect(status?.longLabel).toBe('Scanning…');
    });
  });

  describe('Apply phase uses action language', () => {
    it('present shows as "Already present"', () => {
      const status = PHASE_STATUS_MAP.apply.present;
      expect(status?.shortLabel).toBe('PRESENT');
      expect(status?.longLabel).toBe('Already present');
      expect(status?.color).toBe('success');
    });

    it('to_install shows as "To install"', () => {
      const status = PHASE_STATUS_MAP.apply.to_install;
      expect(status?.shortLabel).toBe('TO INSTALL');
      expect(status?.longLabel).toBe('To install');
      expect(status?.color).toBe('info');
    });

    it('installing shows as "Installing"', () => {
      const status = PHASE_STATUS_MAP.apply.installing;
      expect(status?.shortLabel).toBe('INSTALLING');
      expect(status?.longLabel).toBe('Installing…');
    });

    it('installed shows as "Installed"', () => {
      const status = PHASE_STATUS_MAP.apply.installed;
      expect(status?.shortLabel).toBe('INSTALLED');
      expect(status?.longLabel).toBe('Installed');
      expect(status?.color).toBe('success');
    });

    it('failed shows as "Failed"', () => {
      const status = PHASE_STATUS_MAP.apply.failed;
      expect(status?.shortLabel).toBe('FAILED');
      expect(status?.longLabel).toBe('Failed');
      expect(status?.color).toBe('error');
    });
  });

  describe('Verify phase uses confirmation language', () => {
    it('present shows as "Confirmed" (not "Already present")', () => {
      const status = PHASE_STATUS_MAP.verify.present;
      expect(status?.shortLabel).toBe('CONFIRMED');
      expect(status?.longLabel).toBe('Confirmed');
      expect(status?.color).toBe('success');
    });

    it('installed shows as "Confirmed"', () => {
      const status = PHASE_STATUS_MAP.verify.installed;
      expect(status?.shortLabel).toBe('CONFIRMED');
      expect(status?.longLabel).toBe('Confirmed');
    });

    it('to_install shows as "Missing" (not "To install")', () => {
      const status = PHASE_STATUS_MAP.verify.to_install;
      expect(status?.shortLabel).toBe('MISSING');
      expect(status?.longLabel).toBe('Missing');
      expect(status?.color).toBe('error');
    });

    it('installing shows as "Checking"', () => {
      const status = PHASE_STATUS_MAP.verify.installing;
      expect(status?.shortLabel).toBe('CHECKING');
      expect(status?.longLabel).toBe('Checking…');
    });

    it('failed shows as "Version mismatch"', () => {
      const status = PHASE_STATUS_MAP.verify.failed;
      expect(status?.shortLabel).toBe('MISMATCH');
      expect(status?.longLabel).toBe('Version mismatch');
      expect(status?.color).toBe('warn'); // Mismatch uses warning (amber), not error
    });
  });
});

describe('getPhaseAwareStatus - Phase-Aware Status Resolution', () => {
  it('returns phase-specific config when phase is provided', () => {
    const captureStatus = getPhaseAwareStatus('present', 'capture');
    expect(captureStatus.shortLabel).toBe('DETECTED');

    const applyStatus = getPhaseAwareStatus('present', 'apply');
    expect(applyStatus.shortLabel).toBe('PRESENT');

    const verifyStatus = getPhaseAwareStatus('present', 'verify');
    expect(verifyStatus.shortLabel).toBe('CONFIRMED');
  });

  it('falls back to UI_STATUS_MAP when phase is undefined', () => {
    const status = getPhaseAwareStatus('present');
    expect(status.shortLabel).toBe('PRESENT');
    expect(status.longLabel).toBe('Already present');
  });

  it('falls back to UI_STATUS_MAP for unknown status', () => {
    const status = getPhaseAwareStatus('unknown' as any, 'apply');
    expect(status.shortLabel).toBe('SKIPPED');
  });

  it('Verify phase: to_install maps to Missing (red)', () => {
    const status = getPhaseAwareStatus('to_install', 'verify');
    expect(status.shortLabel).toBe('MISSING');
    expect(status.color).toBe('error');
  });

  it('Capture phase: skipped maps to Excluded (muted)', () => {
    const status = getPhaseAwareStatus('skipped', 'capture');
    expect(status.shortLabel).toBe('EXCLUDED');
    expect(status.color).toBe('muted');
  });
});

/**
 * Tests for reason-aware phase status resolution.
 * getPhaseAwareStatusForEvent discriminates "skipped" subtypes by reason.
 */
describe('getPhaseAwareStatusForEvent - Reason-Aware Status Resolution', () => {
  describe('Capture phase: reason-aware discrimination', () => {
    it('capture + skipped + reason=filtered -> EXCLUDED (muted)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'capture',
        reason: 'filtered',
      });
      expect(status.shortLabel).toBe('EXCLUDED');
      expect(status.longLabel).toBe('Excluded');
      expect(status.color).toBe('muted');
    });

    it('capture + skipped + reason=sensitive -> PROTECTED (warn)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'capture',
        reason: 'sensitive',
      });
      expect(status.shortLabel).toBe('PROTECTED');
      expect(status.longLabel).toBe('Protected');
      expect(status.color).toBe('warn');
    });

    it('capture + skipped + reason=sensitive_excluded -> PROTECTED (warn)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'capture',
        reason: 'sensitive_excluded',
      });
      expect(status.shortLabel).toBe('PROTECTED');
      expect(status.longLabel).toBe('Protected');
      expect(status.color).toBe('warn');
    });

    it('capture + skipped + reason=filtered_runtime -> EXCLUDED (muted)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'capture',
        reason: 'filtered_runtime',
      });
      expect(status.shortLabel).toBe('EXCLUDED');
      expect(status.longLabel).toBe('Excluded');
      expect(status.color).toBe('muted');
    });

    it('capture + skipped + reason=filtered_store -> EXCLUDED (muted)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'capture',
        reason: 'filtered_store',
      });
      expect(status.shortLabel).toBe('EXCLUDED');
      expect(status.longLabel).toBe('Excluded');
      expect(status.color).toBe('muted');
    });

    it('capture + present + reason=detected -> DETECTED (detected color)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'present',
        phase: 'capture',
        reason: 'detected',
      });
      expect(status.shortLabel).toBe('DETECTED');
      expect(status.longLabel).toBe('Detected');
      expect(status.color).toBe('detected');
    });

    it('capture + present -> DETECTED (detected color)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'present',
        phase: 'capture',
      });
      expect(status.shortLabel).toBe('DETECTED');
      expect(status.color).toBe('detected');
    });

    it('capture + to_install -> NOT FOUND (muted)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'to_install',
        phase: 'capture',
      });
      expect(status.shortLabel).toBe('NOT FOUND');
      expect(status.color).toBe('muted');
    });

    it('capture + failed -> ERROR (error)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'failed',
        phase: 'capture',
      });
      expect(status.shortLabel).toBe('ERROR');
      expect(status.color).toBe('error');
    });

    it('capture + installing -> SCANNING (info)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'installing',
        phase: 'capture',
      });
      expect(status.shortLabel).toBe('SCANNING');
      expect(status.color).toBe('info');
    });
  });

  describe('Apply phase: reason-aware discrimination', () => {
    it('apply + skipped + reason=already_installed -> PRESENT (success), NOT "Skipped"', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'apply',
        reason: 'already_installed',
      });
      expect(status.shortLabel).toBe('PRESENT');
      expect(status.longLabel).toBe('Already present');
      expect(status.color).toBe('success');
    });

    it('apply + skipped + reason=already_present -> PRESENT (success)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'apply',
        reason: 'already_present',
      });
      expect(status.shortLabel).toBe('PRESENT');
      expect(status.color).toBe('success');
    });

    it('apply + skipped + reason=filtered -> SKIPPED (warn) - true exclusion', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'apply',
        reason: 'filtered',
      });
      expect(status.shortLabel).toBe('SKIPPED');
      expect(status.color).toBe('warn');
    });

    it('apply + present -> PRESENT (success)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'present',
        phase: 'apply',
      });
      expect(status.shortLabel).toBe('PRESENT');
      expect(status.color).toBe('success');
    });
  });

  describe('Verify phase: reason-aware discrimination', () => {
    it('verify + to_install -> MISSING (error)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'to_install',
        phase: 'verify',
      });
      expect(status.shortLabel).toBe('MISSING');
      expect(status.color).toBe('error');
    });

    it('verify + present -> CONFIRMED (success)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'present',
        phase: 'verify',
      });
      expect(status.shortLabel).toBe('CONFIRMED');
      expect(status.color).toBe('success');
    });

    it('verify + skipped + reason=already_installed -> CONFIRMED (success)', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'verify',
        reason: 'already_installed',
      });
      expect(status.shortLabel).toBe('CONFIRMED');
      expect(status.color).toBe('success');
    });
  });

  describe('Fallback behavior', () => {
    it('falls back to getPhaseAwareStatus when no reason-specific rule matches', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'installed',
        phase: 'apply',
      });
      expect(status.shortLabel).toBe('INSTALLED');
      expect(status.color).toBe('success');
    });

    it('falls back to UI_STATUS_MAP when no phase provided', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'present',
      });
      expect(status.shortLabel).toBe('PRESENT');
      expect(status.longLabel).toBe('Already present');
    });

    it('handles null reason gracefully', () => {
      const status = getPhaseAwareStatusForEvent({
        statusKey: 'skipped',
        phase: 'capture',
        reason: null,
      });
      expect(status.shortLabel).toBe('EXCLUDED');
    });
  });
});

/**
 * Tests for itemEventToAppEvent reason propagation.
 */
describe('itemEventToAppEvent - Reason Propagation', () => {
  it('propagates reason from ItemEvent to AppEvent', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'App.Id',
      driver: 'winget',
      status: 'skipped',
      reason: 'filtered',
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent, 'apply');

    expect(appEvent.reason).toBe('filtered');
  });

  it('propagates null reason correctly', () => {
    const itemEvent: ItemEvent = {
      version: 1,
      event: 'item',
      id: 'App.Id',
      driver: 'winget',
      status: 'present',
      reason: null,
      timestamp: '2025-01-01T00:00:00.000Z',
    };

    const appEvent = itemEventToAppEvent(itemEvent, 'apply');

    expect(appEvent.reason).toBeNull();
  });
});
