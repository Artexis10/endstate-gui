import { describe, it, expect } from 'vitest';
import { getPhaseAwareStatusForEvent, type StatusKey, type UiPhase } from './apply-utils';

/**
 * REGRESSION TEST: Phase-aware status mapping for filter predicates
 * 
 * Ensures that filter pills correctly match the actual labels shown in the UI.
 * This prevents bugs where pills show counts but filtering shows 0 items.
 */
describe('Phase-aware status mapping for filters', () => {
  it('Capture phase: already_present -> "Detected"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'already_present',
      phase: 'capture',
    });
    
    expect(result.longLabel).toBe('Detected');
    expect(result.color).toBe('success');
  });

  it('Apply phase: already_present -> "Already present"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'already_present',
      phase: 'apply',
    });
    
    expect(result.longLabel).toBe('Already present');
    expect(result.color).toBe('success');
  });

  it('Apply phase: to_install -> "To install"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'to_install',
      phase: 'apply',
    });
    
    expect(result.longLabel).toBe('To install');
    expect(result.color).toBe('info');
  });

  it('Apply phase: skipped with reason "already_installed" -> "Already present"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'skipped',
      phase: 'apply',
      reason: 'already_installed',
    });
    
    expect(result.longLabel).toBe('Already present');
    expect(result.color).toBe('success');
  });

  it('Apply phase: skipped with reason "filtered" -> "Skipped"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'skipped',
      phase: 'apply',
      reason: 'filtered',
    });
    
    expect(result.longLabel).toBe('Skipped');
    expect(result.color).toBe('warn');
  });

  it('Verify phase: already_present -> "Confirmed"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'already_present',
      phase: 'verify',
    });
    
    expect(result.longLabel).toBe('Confirmed');
    expect(result.color).toBe('success');
  });

  it('Verify phase: to_install -> "Missing"', () => {
    const result = getPhaseAwareStatusForEvent({
      statusKey: 'to_install',
      phase: 'verify',
    });
    
    expect(result.longLabel).toBe('Missing');
    expect(result.color).toBe('error');
  });

  it('Filter predicate example: matching "Already present" in apply phase', () => {
    // Simulate an event from the engine
    const event = {
      app: 'Git.Git',
      action: 'OK',
      statusKey: 'already_present' as StatusKey,
      phase: 'apply' as UiPhase,
      reason: null,
    };

    // Get the UI label for this event
    const uiStatus = getPhaseAwareStatusForEvent({
      statusKey: event.statusKey,
      phase: event.phase,
      reason: event.reason,
    });

    // Filter predicate: should match "Already present"
    const filterLabel = 'Already present';
    const matches = uiStatus.longLabel === filterLabel;

    expect(matches).toBe(true);
    expect(uiStatus.longLabel).toBe('Already present');
  });

  it('Filter predicate example: matching "To install" in apply phase', () => {
    const event = {
      app: 'VSCode',
      action: 'To install',
      statusKey: 'to_install' as StatusKey,
      phase: 'apply' as UiPhase,
      reason: 'would_install',
    };

    const uiStatus = getPhaseAwareStatusForEvent({
      statusKey: event.statusKey,
      phase: event.phase,
      reason: event.reason,
    });

    const filterLabel = 'To install';
    const matches = uiStatus.longLabel === filterLabel;

    expect(matches).toBe(true);
    expect(uiStatus.longLabel).toBe('To install');
  });

  it('Filter predicate example: NOT matching "Skipped" for already_present', () => {
    const event = {
      app: 'Chrome',
      action: 'OK',
      statusKey: 'already_present' as StatusKey,
      phase: 'apply' as UiPhase,
      reason: 'already_installed',
    };

    const uiStatus = getPhaseAwareStatusForEvent({
      statusKey: event.statusKey,
      phase: event.phase,
      reason: event.reason,
    });

    const filterLabel = 'Skipped';
    const matches = uiStatus.longLabel === filterLabel;

    // Should NOT match "Skipped" - this is "Already present"
    expect(matches).toBe(false);
    expect(uiStatus.longLabel).toBe('Already present');
  });
});
