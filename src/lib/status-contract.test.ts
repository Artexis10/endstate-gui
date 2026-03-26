/**
 * Status/Phase Contract Tests
 * 
 * Locks critical semantic mappings defined in docs/UX_LANGUAGE.md.
 * These tests prevent drift between engine events and UI display.
 * 
 * DO NOT modify these tests without updating UX_LANGUAGE.md.
 */

import { describe, it, expect } from 'vitest';
import { 
  engineStatusToStatusKey,
  getPhaseAwareStatusForEvent,
  type StatusKey,
} from './apply-utils';

describe('Status/Phase Contract (UX_LANGUAGE.md)', () => {
  describe('Critical Semantic Rule 1: MISSING vs FAILED (Verify Phase)', () => {
    it('verify + (failed, missing) → MISSING (warn), not FAILED (error)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('failed');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'verify',
        reason: 'missing',
      });

      expect(result.shortLabel).toBe('MISSING');
      expect(result.longLabel).toBe('Missing');
      expect(result.color).toBe('warn');
    });

    it('verify + (failed, other reason) → FAILED (error)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('failed');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'verify',
        reason: 'verification_error',
      });

      expect(result.shortLabel).toBe('FAILED');
      expect(result.color).toBe('error');
    });
  });

  describe('Critical Semantic Rule 2: CANCELLED vs FAILED (Apply Phase)', () => {
    it('apply + (skipped, user_denied) → CANCELLED (warn), not FAILED (error)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('skipped');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: 'user_denied',
      });

      expect(result.shortLabel).toBe('CANCELLED');
      expect(result.longLabel).toBe('User cancelled');
      expect(result.color).toBe('warn');
    });

    it('apply + (failed, install_failed) → FAILED (error)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('failed');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: 'install_failed',
      });

      expect(result.shortLabel).toBe('FAILED');
      expect(result.color).toBe('error');
    });
  });

  describe('Critical Semantic Rule 3: PRESENT vs CONFIRMED', () => {
    it('apply + present → PRESENT (success)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('present');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: null,
      });

      expect(result.shortLabel).toBe('PRESENT');
      expect(result.longLabel).toBe('Already present');
      expect(result.color).toBe('success');
    });

    it('verify + present → CONFIRMED (success)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('present');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'verify',
        reason: null,
      });

      expect(result.shortLabel).toBe('CONFIRMED');
      expect(result.longLabel).toBe('Confirmed');
      expect(result.color).toBe('success');
    });
  });

  describe('Critical Semantic Rule 4: INSTALLED vs CONFIRMED', () => {
    it('apply + installed → INSTALLED (success)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('installed');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: null,
      });

      expect(result.shortLabel).toBe('INSTALLED');
      expect(result.longLabel).toBe('Installed');
      expect(result.color).toBe('success');
    });

    it('verify + installed → INSTALLED (success), not CONFIRMED', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('installed');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'verify',
        reason: null,
      });

      // Verify phase shows INSTALLED for installed status (not CONFIRMED)
      expect(result.shortLabel).toBe('INSTALLED');
      expect(result.color).toBe('success');
    });
  });

  describe('Apply Phase: skipped + already_installed → PRESENT (not SKIPPED)', () => {
    it('apply + (skipped, already_installed) → PRESENT (success)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('skipped');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: 'already_installed',
      });

      expect(result.shortLabel).toBe('PRESENT');
      expect(result.longLabel).toBe('Already present');
      expect(result.color).toBe('success');
    });
  });

  describe('Verify Phase: skipped + already_installed → CONFIRMED (not SKIPPED)', () => {
    it('verify + (skipped, already_installed) → CONFIRMED (success)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('skipped');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'verify',
        reason: 'already_installed',
      });

      expect(result.shortLabel).toBe('CONFIRMED');
      expect(result.longLabel).toBe('Confirmed');
      expect(result.color).toBe('success');
    });
  });

  describe('Engine Status → GUI StatusKey Mapping', () => {
    it('maps engine status to GUI StatusKey correctly', () => {
      expect(engineStatusToStatusKey('present')).toBe('present');
      expect(engineStatusToStatusKey('to_install')).toBe('to_install');
      expect(engineStatusToStatusKey('installing')).toBe('installing');
      expect(engineStatusToStatusKey('installed')).toBe('installed');
      expect(engineStatusToStatusKey('skipped')).toBe('skipped');
      expect(engineStatusToStatusKey('failed')).toBe('failed');
    });
  });

  describe('Critical Semantic Rule 5: MANUAL (Apply Phase)', () => {
    it('apply + (skipped, manual_required) → MANUAL (warn)', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('skipped');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: 'manual_required',
      });

      expect(result.shortLabel).toBe('MANUAL');
      expect(result.longLabel).toBe('Manual installation required');
      expect(result.color).toBe('warn');
    });

    it('apply + manual_required is NOT SKIPPED or FAILED', () => {
      const statusKey: StatusKey = engineStatusToStatusKey('skipped');
      const result = getPhaseAwareStatusForEvent({
        statusKey,
        phase: 'apply',
        reason: 'manual_required',
      });

      expect(result.shortLabel).not.toBe('SKIPPED');
      expect(result.shortLabel).not.toBe('FAILED');
      expect(result.color).not.toBe('error');
    });
  });
});
