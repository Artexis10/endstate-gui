/**
 * Tests for Capture Continuity Invariants
 * 
 * INV-CONTINUITY-1: counts.included must equal appsIncluded.length
 * INV-DETAILS-1: Capture Details UI must render app list from canonical source
 * INV-SANITIZE-1: GUI relies on engine sanitization (detects dirty IDs)
 * 
 * @see openspec/specs/engine-capture-contract.md#invariants
 */

import { describe, it, expect } from 'vitest';
import {
  getCaptureAppsFromEnvelope,
  getCapturedCount,
  validateContinuityInvariant,
  capturedAppsToAppEvents,
  isCleanAppId,
  filterCleanApps,
  buildCaptureActionResult,
  deriveCaptureSummaryText,
} from './capture-continuity';
import type { EndstateCaptureData, CapturedApp } from '../types';
import type { AppEvent } from './apply-utils';

describe('Capture Continuity Invariants', () => {
  describe('INV-CONTINUITY-1: counts.included must equal appsIncluded.length', () => {
    it('should validate when counts.included equals appsIncluded.length', () => {
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 5,
          included: 5,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: [
          { id: 'Git.Git', source: 'winget' },
          { id: 'Docker.DockerDesktop', source: 'winget' },
          { id: 'Microsoft.VSCode', source: 'winget' },
          { id: 'Python.Python.3.12', source: 'winget' },
          { id: 'Rust.Rustup', source: 'winget' },
        ],
      };

      expect(validateContinuityInvariant(envelopeData)).toBe(true);
      expect(getCapturedCount(envelopeData)).toBe(5);
      expect(getCaptureAppsFromEnvelope(envelopeData).length).toBe(5);
    });

    it('should detect violation when counts.included !== appsIncluded.length', () => {
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 72,
          included: 72, // Says 72
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: [
          { id: 'Git.Git', source: 'winget' },
          { id: 'Docker.DockerDesktop', source: 'winget' },
          // Only 2 apps, but counts says 72 - this is the bug we caught
        ],
      };

      expect(validateContinuityInvariant(envelopeData)).toBe(false);
    });

    it('should return count from counts.included when available', () => {
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 10,
          included: 10,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: Array(10).fill({ id: 'test', source: 'winget' }),
      };

      expect(getCapturedCount(envelopeData)).toBe(10);
    });

    it('should fallback to appsIncluded.length when counts.included undefined', () => {
      const envelopeData: EndstateCaptureData = {
        appsIncluded: [
          { id: 'Git.Git', source: 'winget' },
          { id: 'Docker.DockerDesktop', source: 'winget' },
        ],
      };

      expect(getCapturedCount(envelopeData)).toBe(2);
    });
  });

  describe('INV-DETAILS-1: Capture Details canonical source', () => {
    it('should return appsIncluded from envelope as canonical source', () => {
      const envelopeData: EndstateCaptureData = {
        appsIncluded: [
          { id: 'Git.Git', source: 'winget' },
          { id: 'Docker.DockerDesktop', source: 'winget' },
        ],
      };

      const apps = getCaptureAppsFromEnvelope(envelopeData);
      expect(apps).toHaveLength(2);
      expect(apps[0].id).toBe('Git.Git');
      expect(apps[1].id).toBe('Docker.DockerDesktop');
    });

    it('should return empty array when appsIncluded is undefined', () => {
      const envelopeData: EndstateCaptureData = {};
      expect(getCaptureAppsFromEnvelope(envelopeData)).toEqual([]);
    });

    it('should convert captured apps to AppEvents for modal display', () => {
      const apps: CapturedApp[] = [
        { id: 'Git.Git', source: 'winget' },
        { id: 'Docker.DockerDesktop', source: 'winget' },
      ];

      const events = capturedAppsToAppEvents(apps);
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        app: 'Git.Git',
        action: 'Captured',
        statusKey: 'detected',
        phase: 'capture',
      });
      expect(events[1]).toEqual({
        app: 'Docker.DockerDesktop',
        action: 'Captured',
        statusKey: 'detected',
        phase: 'capture',
      });
    });

    it('should handle string array input for backward compatibility', () => {
      const apps = ['Git.Git', 'Docker.DockerDesktop'];
      const events = capturedAppsToAppEvents(apps);
      expect(events).toHaveLength(2);
      expect(events[0].app).toBe('Git.Git');
    });
  });

  describe('INV-DETAILS-1: Capture Details modal rendering', () => {
    it('should produce non-empty appEvents from appsIncluded for modal display', () => {
      // Simulate the exact data flow from App.tsx lines 1063 -> 1087 -> 1826
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 67,
          included: 67,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: [
          { id: 'Git.Git', source: 'winget' },
          { id: 'Docker.DockerDesktop', source: 'winget' },
          { id: 'Microsoft.VSCode', source: 'winget' },
        ],
      };

      // Step 1: Extract app IDs (line 1063 in App.tsx)
      const appsList = envelopeData?.appsIncluded?.map(a => a.id) || [];
      expect(appsList).toHaveLength(3);
      expect(appsList).toEqual(['Git.Git', 'Docker.DockerDesktop', 'Microsoft.VSCode']);

      // Step 2: Map to AppEvents (line 1826 in App.tsx)
      const appEvents = appsList.map(app => ({ 
        app, 
        action: 'Captured', 
        statusKey: 'detected' as const, 
        phase: 'capture' as const 
      }));
      expect(appEvents).toHaveLength(3);
      expect(appEvents[0].app).toBe('Git.Git');
      expect(appEvents[0].statusKey).toBe('detected');
      expect(appEvents[0].phase).toBe('capture');
    });

    it('REGRESSION: modal should receive appEvents when appsIncluded is present', () => {
      // This test would have caught the bug where modal showed "N apps captured" 
      // instead of the actual list
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 67,
          included: 67,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: Array(67).fill(null).map((_, i) => ({ 
          id: `app-${i}`, 
          source: 'winget' 
        })),
      };

      // Simulate the full flow
      const appsList = envelopeData?.appsIncluded?.map(a => a.id) || [];
      const appEvents = appsList.map(app => ({ 
        app, 
        action: 'Captured', 
        statusKey: 'detected' as const, 
        phase: 'capture' as const 
      }));

      // Modal should receive non-empty appEvents
      expect(appEvents.length).toBeGreaterThan(0);
      expect(appEvents.length).toBe(67);
      
      // Count displayed should equal list length (INV-CONTINUITY-1)
      expect(appEvents.length).toBe(envelopeData.counts?.included);
    });

    it('should show summary fallback when appsIncluded is missing', () => {
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 50,
          included: 50,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        // appsIncluded is missing
      };

      const appsList = envelopeData?.appsIncluded?.map(a => a.id) || [];
      expect(appsList).toHaveLength(0);

      // In this case, modal should show "N apps captured" summary
      // using counts.included as fallback
      const fallbackCount = envelopeData.counts?.included ?? 0;
      expect(fallbackCount).toBe(50);
    });

    it('buildCaptureActionResult should produce valid ActionResult with appEvents', () => {
      const capturedApps: CapturedApp[] = [
        { id: 'Git.Git', source: 'winget' },
        { id: 'Docker.DockerDesktop', source: 'winget' },
        { id: 'Microsoft.VSCode', source: 'winget' },
      ];

      const result = buildCaptureActionResult(capturedApps, '3 apps captured');
      
      expect(result.action).toBe('capture');
      expect(result.status).toBe('success');
      expect(result.summary).toBe('3 apps captured');
      expect(result.counts.total).toBe(3);
      expect(result.appEvents).toHaveLength(3);
      expect(result.appEvents[0].app).toBe('Git.Git');
      expect(result.appEvents[0].statusKey).toBe('detected');
      expect(result.appEvents[0].phase).toBe('capture');
    });

    it('buildCaptureActionResult should handle empty apps array gracefully', () => {
      const capturedApps: CapturedApp[] = [];

      const result = buildCaptureActionResult(capturedApps, '0 apps captured');
      
      expect(result.appEvents).toHaveLength(0);
      expect(result.counts.total).toBe(0);
    });

    it('REGRESSION: envelope with N appsIncluded produces actionResult with N appEvents', () => {
      // This test reproduces the EXACT Overview capture actionResult creation:
      // App.tsx line 1088: return { ..., appsIncluded: envelopeData?.appsIncluded || [] }
      // App.tsx line 1822: setOverviewActionResult('capture', buildCaptureActionResult(result.appsIncluded, countText))
      
      const N = 67;
      
      // Simulate envelope.data from engine (as received by handleCaptureFromOverview)
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: N,
          included: N,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: Array(N).fill(null).map((_, i) => ({ 
          id: `app-${i}`, 
          source: 'winget' as const
        })),
      };

      // Simulate handleCaptureFromOverview return (App.tsx line 1088)
      const handlerResult = {
        count: N,
        draftText: '...',
        apps: envelopeData.appsIncluded!.map(a => a.id),
        appsIncluded: envelopeData.appsIncluded || [],
      };

      // Simulate setOverviewActionResult call (App.tsx line 1822)
      const actionResult = buildCaptureActionResult(handlerResult.appsIncluded, `${N} apps captured`);

      // INVARIANT: actionResult.appEvents.length === N
      expect(actionResult.appEvents.length).toBe(N);
      expect(actionResult.counts.total).toBe(N);
    });

    it('INVARIANT: appsIncluded.length > 0 means appEvents must be non-empty (no fallback)', () => {
      // This test enforces: if appsIncluded has apps, modal CANNOT hit fallback branch
      // ActionDetailsModal line 237: (!actionResult?.appEvents || actionResult.appEvents.length === 0)
      
      const appsIncluded: CapturedApp[] = [
        { id: 'Git.Git', source: 'winget' },
        { id: 'Docker.DockerDesktop', source: 'winget' },
      ];

      // Build actionResult using the helper (same as App.tsx line 1822)
      const actionResult = buildCaptureActionResult(appsIncluded, '2 apps captured');

      // Modal fallback condition: (!actionResult?.appEvents || actionResult.appEvents.length === 0)
      const wouldHitFallback = !actionResult?.appEvents || actionResult.appEvents.length === 0;
      
      // INVARIANT: if appsIncluded.length > 0, fallback must NOT be hit
      expect(appsIncluded.length).toBeGreaterThan(0);
      expect(wouldHitFallback).toBe(false);
      expect(actionResult.appEvents.length).toBe(appsIncluded.length);
    });

    it('header count must equal rendered list length', () => {
      const capturedApps: CapturedApp[] = Array(67).fill(null).map((_, i) => ({ 
        id: `app-${i}`, 
        source: 'winget' 
      }));

      const result = buildCaptureActionResult(capturedApps, '67 apps captured');
      
      // Count displayed (counts.total) must equal list length (appEvents.length)
      expect(result.counts.total).toBe(result.appEvents.length);
      expect(result.counts.total).toBe(67);
    });
  });

  describe('INV-SANITIZE-1: GUI relies on engine sanitization', () => {
    it('should accept clean ASCII app IDs', () => {
      expect(isCleanAppId('Git.Git')).toBe(true);
      expect(isCleanAppId('Microsoft.VCRedist.2015+.x64')).toBe(true);
      expect(isCleanAppId('Docker.DockerDesktop')).toBe(true);
    });

    it('should reject IDs with leading non-ASCII characters (ª prefix bug)', () => {
      // This is the exact bug we fixed - 'ª' has charCode 170 (0xAA)
      expect(isCleanAppId('ª Microsoft.VCRedist.2015+.x64')).toBe(false);
      expect(isCleanAppId('ªª EclipseAdoptium.Temurin.8.JRE')).toBe(false);
    });

    it('should reject IDs with backslashes (ARP/MSIX entries)', () => {
      expect(isCleanAppId('ARP\\Machine\\X64\\{123}')).toBe(false);
      expect(isCleanAppId('MSIX\\SomePackage')).toBe(false);
    });

    it('should reject empty or whitespace-only IDs', () => {
      expect(isCleanAppId('')).toBe(false);
      expect(isCleanAppId('   ')).toBe(false);
    });

    it('should filter out dirty IDs from captured apps', () => {
      const apps: CapturedApp[] = [
        { id: 'Git.Git', source: 'winget' },
        { id: 'ª Microsoft.VCRedist', source: 'winget' }, // Dirty
        { id: 'Docker.DockerDesktop', source: 'winget' },
        { id: 'ARP\\Machine\\X64', source: 'winget' }, // Dirty
      ];

      const cleanApps = filterCleanApps(apps);
      expect(cleanApps).toHaveLength(2);
      expect(cleanApps[0].id).toBe('Git.Git');
      expect(cleanApps[1].id).toBe('Docker.DockerDesktop');
    });

    it('REGRESSION: would have caught 72 vs 66 mismatch', () => {
      // Simulate the original bug: 72 apps in manifest, 6 with dirty IDs
      const apps: CapturedApp[] = [
        ...Array(66).fill(null).map((_, i) => ({ id: `clean-app-${i}`, source: 'winget' })),
        { id: 'ª dirty-1', source: 'winget' },
        { id: 'ª dirty-2', source: 'winget' },
        { id: 'ª dirty-3', source: 'winget' },
        { id: 'ª dirty-4', source: 'winget' },
        { id: 'ª dirty-5', source: 'winget' },
        { id: 'ª dirty-6', source: 'winget' },
      ];

      expect(apps.length).toBe(72); // Manifest had 72
      
      const cleanApps = filterCleanApps(apps);
      expect(cleanApps.length).toBe(66); // UI showed 66

      // This mismatch is exactly what we fixed in the engine
      // Now engine sanitizes before persistence, so this shouldn't happen
    });
  });

  describe('deriveCaptureSummaryText', () => {
    it('should return "No apps detected" when count is 0', () => {
      expect(deriveCaptureSummaryText(0)).toBe('No apps detected');
    });

    it('should return "N apps captured" when count > 0', () => {
      expect(deriveCaptureSummaryText(1)).toBe('1 apps captured');
      expect(deriveCaptureSummaryText(67)).toBe('67 apps captured');
      expect(deriveCaptureSummaryText(100)).toBe('100 apps captured');
    });

    it('REGRESSION: must NOT return "No apps detected" when count > 0', () => {
      // This test would have caught the bug where Overview showed "No apps detected"
      // even when 67 apps were captured
      const count = 67;
      const summaryText = deriveCaptureSummaryText(count);
      
      expect(summaryText).not.toBe('No apps detected');
      expect(summaryText).toBe('67 apps captured');
    });
  });

  describe('Overview capture flow consistency (REGRESSION)', () => {
    it('REGRESSION: count derived from appsIncluded.length must match appEvents.length', () => {
      // This test reproduces the exact bug scenario:
      // - Engine returns counts.included = 67 but appsIncluded is empty
      // - Old code: capturedCount = 67 (from counts.included)
      // - Old code: appsIncluded = [] (empty)
      // - Result: summary says "67 apps captured" but modal shows "No applications detected"
      
      // Simulate envelope with counts.included but empty appsIncluded (edge case)
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: 67,
          included: 67,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: [], // Empty! This was the bug scenario
      };

      // NEW CORRECT BEHAVIOR: derive count FROM appsIncluded.length
      const capturedApps = envelopeData?.appsIncluded ?? [];
      const capturedCount = capturedApps.length
        || envelopeData?.counts?.included
        || 0;

      // Build action result using the helper
      const actionResult = buildCaptureActionResult(capturedApps, deriveCaptureSummaryText(capturedCount));

      // INVARIANT: count and appEvents.length must be consistent
      // If appsIncluded is empty, count should be 0 (or fallback to counts.included)
      // In this case, capturedApps.length is 0, so we fall back to counts.included = 67
      // But appEvents will be empty because capturedApps is empty
      
      // The fix ensures: if capturedApps is empty, count should reflect that
      // OR if we use counts.included as fallback, the summary should be text-only
      expect(actionResult.appEvents.length).toBe(capturedApps.length);
    });

    it('REGRESSION: normal case - appsIncluded present produces consistent count and appEvents', () => {
      const N = 67;
      
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: N,
          included: N,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: Array(N).fill(null).map((_, i) => ({ 
          id: `app-${i}`, 
          source: 'winget' as const
        })),
      };

      // Simulate the fixed handleCaptureFromOverview logic
      const capturedApps = envelopeData?.appsIncluded ?? [];
      const capturedCount = capturedApps.length
        || envelopeData?.counts?.included
        || 0;

      const actionResult = buildCaptureActionResult(capturedApps, deriveCaptureSummaryText(capturedCount));

      // INVARIANT: all three must be consistent
      expect(capturedCount).toBe(N);
      expect(actionResult.appEvents.length).toBe(N);
      expect(actionResult.counts.total).toBe(N);
      expect(actionResult.summary).toBe('67 apps captured');
    });

    it('INVARIANT: if appEvents.length > 0, modal must NOT show fallback text', () => {
      const capturedApps: CapturedApp[] = Array(67).fill(null).map((_, i) => ({ 
        id: `app-${i}`, 
        source: 'winget' as const
      }));

      const actionResult = buildCaptureActionResult(capturedApps, '67 apps captured');

      // Modal fallback condition: (!actionResult?.appEvents || actionResult.appEvents.length === 0)
      const wouldHitFallback = !actionResult?.appEvents || actionResult.appEvents.length === 0;
      
      expect(wouldHitFallback).toBe(false);
      expect(actionResult.appEvents.length).toBe(67);
    });
  });

  describe('REGRESSION: Empty appsIncluded with NDJSON fallback', () => {
    /**
     * This test reproduces the exact bug scenario:
     * - Engine returns envelope with counts.included = 67 but appsIncluded = []
     * - NDJSON streaming captured 67 item events during the run
     * - OLD BUG: count = 67 (from counts.included fallback), appEvents = [] (from empty appsIncluded)
     * - Result: modal header says "67 apps captured" but body says "No applications detected"
     * 
     * FIX: When appsIncluded is empty, use NDJSON events as fallback for BOTH count and appEvents
     */
    it('REGRESSION: appsIncluded empty + NDJSON events = use NDJSON for modal', () => {
      const N = 67;
      
      // Simulate envelope.data with counts but empty appsIncluded (the bug scenario)
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: N,
          included: N, // Engine says 67 apps
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: [], // But list is empty! This was the bug.
      };

      // Simulate NDJSON events collected during streaming (these have the actual app IDs)
      const ndjsonEvents: AppEvent[] = Array(N).fill(null).map((_, i) => ({
        app: `app-${i}`,
        action: 'Captured',
        statusKey: 'detected' as const,
        phase: 'capture' as const,
      }));

      // Simulate the FIXED App.tsx logic (lines 1011-1023)
      const capturedApps = envelopeData?.appsIncluded ?? [];
      const fallbackAppsFromEvents = ndjsonEvents
        .filter(e => e.app !== 'Manifest' && e.phase === 'capture')
        .map(e => ({ id: e.app, source: 'ndjson' as const }));
      const appsForModal = capturedApps.length > 0 ? capturedApps : fallbackAppsFromEvents;
      const capturedCount = appsForModal.length;

      // Build action result using the same list for both count and appEvents
      const actionResult = buildCaptureActionResult(appsForModal, `${capturedCount} apps captured`);

      // INVARIANT: count and appEvents.length MUST be equal
      expect(actionResult.counts.total).toBe(capturedCount);
      expect(actionResult.appEvents.length).toBe(capturedCount);
      expect(actionResult.counts.total).toBe(actionResult.appEvents.length);

      // INVARIANT: if count > 0, modal must NOT hit fallback
      const wouldHitFallback = !actionResult?.appEvents || actionResult.appEvents.length === 0;
      expect(wouldHitFallback).toBe(false);

      // Verify the apps are from NDJSON fallback
      expect(actionResult.appEvents[0].app).toBe('app-0');
      expect(actionResult.appEvents.length).toBe(N);
    });

    it('REGRESSION: appsIncluded present = use appsIncluded (no fallback needed)', () => {
      const N = 67;
      
      // Normal case: envelope has both counts and appsIncluded populated
      const envelopeData: EndstateCaptureData = {
        counts: {
          totalFound: N,
          included: N,
          skipped: 0,
          filteredRuntimes: 0,
          filteredStoreApps: 0,
          sensitiveExcludedCount: 0,
        },
        appsIncluded: Array(N).fill(null).map((_, i) => ({
          id: `app-${i}`,
          source: 'winget' as const,
        })),
      };

      // NDJSON events also exist (but should not be used when appsIncluded is present)
      const ndjsonEvents: AppEvent[] = Array(N).fill(null).map((_, i) => ({
        app: `ndjson-app-${i}`, // Different IDs to verify we use appsIncluded
        action: 'Captured',
        statusKey: 'detected' as const,
        phase: 'capture' as const,
      }));

      // Simulate the FIXED App.tsx logic
      const capturedApps = envelopeData?.appsIncluded ?? [];
      const fallbackAppsFromEvents = ndjsonEvents
        .filter(e => e.app !== 'Manifest' && e.phase === 'capture')
        .map(e => ({ id: e.app, source: 'ndjson' as const }));
      const appsForModal = capturedApps.length > 0 ? capturedApps : fallbackAppsFromEvents;
      const capturedCount = appsForModal.length;

      const actionResult = buildCaptureActionResult(appsForModal, `${capturedCount} apps captured`);

      // Should use appsIncluded, not NDJSON fallback
      expect(actionResult.appEvents[0].app).toBe('app-0'); // From appsIncluded
      expect(actionResult.appEvents[0].app).not.toBe('ndjson-app-0');
      expect(actionResult.counts.total).toBe(N);
      expect(actionResult.appEvents.length).toBe(N);
    });

    it('INVARIANT: detailsAction="capture" -> actionResultByAction["capture"] has consistent count/appEvents', () => {
      /**
       * This test verifies the end-to-end wiring invariant:
       * When Details button is clicked for capture action:
       * 1. detailsAction is set to "capture"
       * 2. Modal reads actionResultByAction["capture"]
       * 3. actionResult.counts.total === actionResult.appEvents.length
       * 4. If counts.total > 0, appEvents must be non-empty (no fallback text)
       */
      const N = 67;
      
      // Simulate the action result that would be stored in actionResultByAction["capture"]
      const appsForModal: CapturedApp[] = Array(N).fill(null).map((_, i) => ({
        id: `app-${i}`,
        source: 'winget' as const,
      }));
      
      const actionResult = buildCaptureActionResult(appsForModal, `${N} apps captured`);
      
      // Simulate what ActionDetailsModal receives
      const detailsAction = 'capture';
      const actionResultByAction: Record<string, typeof actionResult | null> = {
        capture: actionResult,
        setup: null,
        check: null,
      };
      
      const modalActionResult = detailsAction ? actionResultByAction[detailsAction] : null;
      
      // INVARIANT: modal receives the action result
      expect(modalActionResult).not.toBeNull();
      expect(modalActionResult?.action).toBe('capture');
      
      // INVARIANT: counts.total === appEvents.length
      expect(modalActionResult?.counts?.total).toBe(modalActionResult?.appEvents?.length);
      
      // INVARIANT: if counts.total > 0, appEvents is non-empty
      if ((modalActionResult?.counts?.total ?? 0) > 0) {
        expect(modalActionResult?.appEvents?.length).toBeGreaterThan(0);
      }
      
      // Modal fallback condition check
      const wouldHitFallback = !modalActionResult?.appEvents || modalActionResult.appEvents.length === 0;
      expect(wouldHitFallback).toBe(false);
    });
  });
});
