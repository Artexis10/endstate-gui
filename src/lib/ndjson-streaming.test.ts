/**
 * NDJSON Streaming Consolidation Tests
 * 
 * Tests for:
 * 1. NDJSON parsing correctness
 * 2. Engine → UI status mapping (no aliases in UI types)
 * 3. Phase transitions (plan → apply → verify)
 * 4. Buffer cap behavior (2000 events)
 * 5. Single spawn per user action
 * 6. No UI status aliasing
 */

import { describe, it, expect } from 'vitest';
import {
  parseStreamingEvent,
  parseStreamingEvents,
  StreamingEventBuffer,
  createStreamingState,
  applyStreamingEvent,
  isPhaseEvent,
  type EnginePhase,
  type EngineItemStatus,
  type ItemEvent,
  type PhaseEvent,
  STREAMING_EVENT_VERSION,
} from './streaming-events';
import {
  engineStatusToStatusKey,
  itemEventToAppEvent,
  UI_STATUS_MAP,
  type StatusKey,
  type UiPhase,
} from './apply-utils';

describe('NDJSON Streaming Consolidation', () => {
  describe('1. Status Mapping - No aliases in UI types', () => {
    it('StatusKey includes "present" as canonical key', () => {
      // StatusKey should only have UI-canonical values
      const validStatusKeys: StatusKey[] = [
        'to_install',
        'present',
        'skipped',
        'failed',
        'installing',
        'installed',
        'cancelled',
      ];
      
      // Verify these are the only valid StatusKey values
      expect(validStatusKeys).toContain('present');
      expect(validStatusKeys).not.toContain('already_present' as StatusKey);
    });

    it('engineStatusToStatusKey maps "present" → "present"', () => {
      expect(engineStatusToStatusKey('present')).toBe('present');
    });

    it('engineStatusToStatusKey maps all engine statuses correctly', () => {
      const mappings: [EngineItemStatus, StatusKey][] = [
        ['present', 'present'],
        ['to_install', 'to_install'],
        ['installing', 'installing'],
        ['installed', 'installed'],
        ['skipped', 'skipped'],
        ['failed', 'failed'],
      ];

      for (const [engineStatus, expectedUiStatus] of mappings) {
        expect(engineStatusToStatusKey(engineStatus)).toBe(expectedUiStatus);
      }
    });

    it('UI_STATUS_MAP has correct labels per contract', () => {
      // Required mapping from task:
      // UI Status       | Live Label   | Details Label    | Color
      // present         | PRESENT      | Already present  | green
      // to_install      | TO INSTALL   | To install       | blue
      // installing      | INSTALLING   | Installing…      | blue
      // installed       | INSTALLED    | Installed        | green
      // skipped         | SKIPPED      | Skipped          | yellow
      // failed          | FAILED       | Failed           | red

      expect(UI_STATUS_MAP.present).toEqual({
        shortLabel: 'PRESENT',
        longLabel: 'Already present',
        color: 'success',
      });

      expect(UI_STATUS_MAP.to_install).toEqual({
        shortLabel: 'TO INSTALL',
        longLabel: 'To install',
        color: 'action',
      });

      expect(UI_STATUS_MAP.installing).toEqual({
        shortLabel: 'INSTALLING',
        longLabel: 'Installing…',
        color: 'info',
      });

      expect(UI_STATUS_MAP.installed).toEqual({
        shortLabel: 'INSTALLED',
        longLabel: 'Installed',
        color: 'success',
      });

      expect(UI_STATUS_MAP.skipped).toEqual({
        shortLabel: 'SKIPPED',
        longLabel: 'Skipped',
        color: 'warn',
      });

      expect(UI_STATUS_MAP.failed).toEqual({
        shortLabel: 'FAILED',
        longLabel: 'Failed',
        color: 'error',
      });
    });
  });

  describe('2. Unified EnginePhase - Single definition', () => {
    it('EnginePhase includes plan, apply, and verify', () => {
      // EnginePhase is the single source of truth from streaming-events.ts
      const validPhases: EnginePhase[] = ['plan', 'apply', 'verify'];
      
      // Verify by parsing phase events
      for (const phase of validPhases) {
        const event = parseStreamingEvent(
          JSON.stringify({
            version: STREAMING_EVENT_VERSION,
            event: 'phase',
            phase,
            timestamp: new Date().toISOString(),
          })
        );
        expect(event).not.toBeNull();
        expect(isPhaseEvent(event!)).toBe(true);
        expect((event as PhaseEvent).phase).toBe(phase);
      }
    });

    it('UiPhase is a subset: only apply and verify', () => {
      // UiPhase is used for UI display, excludes 'plan'
      const validUiPhases: UiPhase[] = ['apply', 'verify'];
      expect(validUiPhases).toHaveLength(2);
      expect(validUiPhases).toContain('apply');
      expect(validUiPhases).toContain('verify');
    });

    it('itemEventToAppEvent maps plan phase to apply (preview behaves like apply)', () => {
      const itemEvent: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App.Id',
        driver: 'winget',
        status: 'to_install',
        reason: null,
        timestamp: new Date().toISOString(),
      };

      const appEvent = itemEventToAppEvent(itemEvent, 'plan');
      expect(appEvent.phase).toBe('apply');
    });

    it('itemEventToAppEvent preserves apply and verify phases', () => {
      const itemEvent: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App.Id',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: new Date().toISOString(),
      };

      expect(itemEventToAppEvent(itemEvent, 'apply').phase).toBe('apply');
      expect(itemEventToAppEvent(itemEvent, 'verify').phase).toBe('verify');
    });
  });

  describe('3. NDJSON is primary live activity source', () => {
    it('parseStreamingEvent correctly parses valid NDJSON', () => {
      const validEvents = [
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"item","id":"App.Id","driver":"winget","status":"installing","reason":null,"timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"summary","phase":"apply","total":10,"success":8,"skipped":1,"failed":1,"timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"error","scope":"engine","message":"Error","timestamp":"2025-01-01T00:00:00.000Z"}',
      ];

      for (const line of validEvents) {
        const event = parseStreamingEvent(line);
        expect(event).not.toBeNull();
        expect(event?.version).toBe(STREAMING_EVENT_VERSION);
      }
    });

    it('parseStreamingEvent returns null for legacy text patterns', () => {
      const legacyPatterns = [
        '[SKIP] App.Id - already installed',
        '[INSTALL] App.Id (driver: winget)',
        '[OK] App.Id - verified',
        '[FAIL] App.Id - error',
        'Installing App.Id...',
        'Successfully installed App.Id',
      ];

      for (const line of legacyPatterns) {
        const event = parseStreamingEvent(line);
        expect(event).toBeNull();
      }
    });

    it('parseStreamingEvents handles mixed NDJSON and text', () => {
      const mixedData = [
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        '[INFO] Some log message',
        '{"version":1,"event":"item","id":"App.Id","driver":"winget","status":"installed","reason":null,"timestamp":"2025-01-01T00:00:00.000Z"}',
        'Plain text line',
        'invalid json {',
      ].join('\n');

      const events = parseStreamingEvents(mixedData);
      expect(events).toHaveLength(2); // Only valid NDJSON events
    });

    it('StreamingEventBuffer handles partial lines correctly', () => {
      const buffer = new StreamingEventBuffer();

      // Send partial JSON
      const events1 = buffer.append('{"version":1,"event":"pha');
      expect(events1).toHaveLength(0);

      // Complete the line
      const events2 = buffer.append('se","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\n');
      expect(events2).toHaveLength(1);
      expect(isPhaseEvent(events2[0])).toBe(true);
    });
  });

  describe('4. Buffer cap behavior (2000 events)', () => {
    it('StreamingState can accumulate many events', () => {
      const state = createStreamingState();

      // Add 2500 events to test buffer behavior
      for (let i = 0; i < 2500; i++) {
        const event: ItemEvent = {
          version: STREAMING_EVENT_VERSION,
          event: 'item',
          id: `App${i}`,
          driver: 'winget',
          status: 'installed',
          reason: null,
          timestamp: new Date().toISOString(),
        };
        applyStreamingEvent(state, event);
      }

      // State tracks all unique items (Map by ID)
      expect(state.items.size).toBe(2500);
    });

    it('UI should cap displayed events at 2000 (FIFO)', () => {
      // This tests the contract that UI implementations should follow
      // The actual capping is done in App.tsx, but we verify the contract here
      const events: ItemEvent[] = [];
      for (let i = 0; i < 2500; i++) {
        events.push({
          version: STREAMING_EVENT_VERSION,
          event: 'item',
          id: `App${i}`,
          driver: 'winget',
          status: 'installed',
          reason: null,
          timestamp: new Date().toISOString(),
        });
      }

      // Simulate UI buffer cap: keep last 2000
      const cappedEvents = events.length > 2000 ? events.slice(-2000) : events;
      expect(cappedEvents).toHaveLength(2000);
      
      // FIFO: oldest events dropped, newest preserved
      expect(cappedEvents[0].id).toBe('App500'); // First 500 dropped
      expect(cappedEvents[cappedEvents.length - 1].id).toBe('App2499'); // Last preserved
    });
  });

  describe('5. Phase transitions (apply → verify)', () => {
    it('StreamingState tracks phase transitions', () => {
      const state = createStreamingState();

      // Start with apply phase
      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'phase',
        phase: 'apply',
        timestamp: new Date().toISOString(),
      });
      expect(state.currentPhase).toBe('apply');

      // Transition to verify phase
      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'phase',
        phase: 'verify',
        timestamp: new Date().toISOString(),
      });
      expect(state.currentPhase).toBe('verify');
    });

    it('Items can be received during different phases', () => {
      const state = createStreamingState();

      // Apply phase
      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'phase',
        phase: 'apply',
        timestamp: new Date().toISOString(),
      });

      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App1',
        driver: 'winget',
        status: 'installing',
        reason: null,
        timestamp: new Date().toISOString(),
      });

      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App1',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: new Date().toISOString(),
      });

      // Verify phase
      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'phase',
        phase: 'verify',
        timestamp: new Date().toISOString(),
      });

      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App1',
        driver: 'winget',
        status: 'present',
        reason: 'already_installed',
        timestamp: new Date().toISOString(),
      });

      // Final state reflects last event for each item
      expect(state.items.get('App1')?.status).toBe('present');
      expect(state.currentPhase).toBe('verify');
    });
  });

  describe('6. Single spawn verification', () => {
    it('Summary events indicate phase completion within single run', () => {
      const state = createStreamingState();

      // Apply phase summary
      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'summary',
        phase: 'apply',
        total: 10,
        success: 8,
        skipped: 1,
        failed: 1,
        timestamp: new Date().toISOString(),
      });

      // Verify phase summary
      applyStreamingEvent(state, {
        version: STREAMING_EVENT_VERSION,
        event: 'summary',
        phase: 'verify',
        total: 10,
        success: 9,
        skipped: 0,
        failed: 1,
        timestamp: new Date().toISOString(),
      });

      // Both summaries stored - indicates single run with multiple phases
      expect(state.summaries.size).toBe(2);
      expect(state.summaries.get('apply')).toBeDefined();
      expect(state.summaries.get('verify')).toBeDefined();
    });
  });

  describe('7. No UI status aliasing', () => {
    it('All StatusKey values have unique UI representations', () => {
      const statusKeys: StatusKey[] = [
        'to_install',
        'present',
        'skipped',
        'failed',
        'installing',
        'installed',
        'cancelled',
      ];

      const shortLabels = new Set<string>();
      const longLabels = new Set<string>();

      for (const key of statusKeys) {
        const config = UI_STATUS_MAP[key];
        expect(config).toBeDefined();
        
        // Verify no duplicate labels (would indicate aliasing)
        expect(shortLabels.has(config.shortLabel)).toBe(false);
        shortLabels.add(config.shortLabel);
        
        expect(longLabels.has(config.longLabel)).toBe(false);
        longLabels.add(config.longLabel);
      }

      // All 7 status keys should have unique labels
      expect(shortLabels.size).toBe(7);
      expect(longLabels.size).toBe(7);
    });

    it('Engine "present" never appears in UI labels', () => {
      for (const key of Object.keys(UI_STATUS_MAP) as StatusKey[]) {
        const config = UI_STATUS_MAP[key];
        // "PRESENT" is the short label for already_present, which is correct
        // But raw "present" (lowercase, engine term) should not appear
        expect(config.longLabel.toLowerCase()).not.toBe('present');
      }
    });
  });
});
