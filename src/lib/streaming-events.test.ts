import { describe, it, expect } from 'vitest';
import {
  parseStreamingEvent,
  parseStreamingEvents,
  StreamingEventBuffer,
  createStreamingState,
  applyStreamingEvent,
  isPhaseEvent,
  isItemEvent,
  isSummaryEvent,
  isErrorEvent,
  STREAMING_EVENT_VERSION,
  type StreamingEvent,
  type PhaseEvent,
  type ItemEvent,
  type SummaryEvent,
  type ErrorEvent,
} from './streaming-events';

describe('streaming-events', () => {
  describe('parseStreamingEvent', () => {
    it('should parse valid phase event', () => {
      const line = '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isPhaseEvent(event!)).toBe(true);
      expect((event as PhaseEvent).phase).toBe('apply');
    });

    it('should parse valid item event', () => {
      const line = '{"version":1,"event":"item","id":"Notepad++.Notepad++","driver":"winget","status":"installing","reason":null,"timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isItemEvent(event!)).toBe(true);
      const itemEvent = event as ItemEvent;
      expect(itemEvent.id).toBe('Notepad++.Notepad++');
      expect(itemEvent.driver).toBe('winget');
      expect(itemEvent.status).toBe('installing');
    });

    it('should parse valid summary event', () => {
      const line = '{"version":1,"event":"summary","phase":"apply","total":10,"success":7,"skipped":2,"failed":1,"timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isSummaryEvent(event!)).toBe(true);
      const summaryEvent = event as SummaryEvent;
      expect(summaryEvent.phase).toBe('apply');
      expect(summaryEvent.total).toBe(10);
      expect(summaryEvent.success).toBe(7);
      expect(summaryEvent.skipped).toBe(2);
      expect(summaryEvent.failed).toBe(1);
    });

    it('should parse valid error event', () => {
      const line = '{"version":1,"event":"error","scope":"engine","message":"Connection failed","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isErrorEvent(event!)).toBe(true);
      const errorEvent = event as ErrorEvent;
      expect(errorEvent.scope).toBe('engine');
      expect(errorEvent.message).toBe('Connection failed');
    });

    it('should return null for empty string', () => {
      expect(parseStreamingEvent('')).toBeNull();
    });

    it('should return null for non-JSON string', () => {
      expect(parseStreamingEvent('not json')).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(parseStreamingEvent('{invalid}')).toBeNull();
    });

    it('should return null for JSON without required fields', () => {
      expect(parseStreamingEvent('{"foo":"bar"}')).toBeNull();
    });

    it('should return null for non-object JSON', () => {
      expect(parseStreamingEvent('"just a string"')).toBeNull();
    });

    it('should return null for log lines', () => {
      expect(parseStreamingEvent('[INFO] Starting apply...')).toBeNull();
      expect(parseStreamingEvent('Installing Notepad++...')).toBeNull();
    });

    it('should handle whitespace around JSON', () => {
      const line = '  {"version":1,"event":"phase","phase":"verify","timestamp":"2025-01-01T00:00:00.000Z"}  ';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isPhaseEvent(event!)).toBe(true);
    });

    it('should handle item event with message', () => {
      const line = '{"version":1,"event":"item","id":"App.Id","driver":"winget","status":"failed","reason":"install_failed","message":"Connection timeout","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      const itemEvent = event as ItemEvent;
      expect(itemEvent.message).toBe('Connection timeout');
      expect(itemEvent.reason).toBe('install_failed');
    });
  });

  describe('parseStreamingEvents', () => {
    it('should parse multiple NDJSON lines', () => {
      const data = [
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"item","id":"App1","driver":"winget","status":"installing","reason":null,"timestamp":"2025-01-01T00:00:01.000Z"}',
        '{"version":1,"event":"item","id":"App1","driver":"winget","status":"installed","reason":null,"timestamp":"2025-01-01T00:00:02.000Z"}',
      ].join('\n');

      const events = parseStreamingEvents(data);
      
      expect(events).toHaveLength(3);
      expect(isPhaseEvent(events[0])).toBe(true);
      expect(isItemEvent(events[1])).toBe(true);
      expect(isItemEvent(events[2])).toBe(true);
    });

    it('should skip invalid lines', () => {
      const data = [
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        '[INFO] Some log message',
        '{"version":1,"event":"item","id":"App1","driver":"winget","status":"installed","reason":null,"timestamp":"2025-01-01T00:00:01.000Z"}',
        'invalid json',
      ].join('\n');

      const events = parseStreamingEvents(data);
      
      expect(events).toHaveLength(2);
    });

    it('should return empty array for empty string', () => {
      expect(parseStreamingEvents('')).toEqual([]);
    });

    it('should return empty array for null/undefined', () => {
      expect(parseStreamingEvents(null as unknown as string)).toEqual([]);
      expect(parseStreamingEvents(undefined as unknown as string)).toEqual([]);
    });
  });

  describe('StreamingEventBuffer', () => {
    it('should buffer partial lines', () => {
      const buffer = new StreamingEventBuffer();
      
      // Send partial JSON
      const events1 = buffer.append('{"version":1,"event":"pha');
      expect(events1).toHaveLength(0);
      
      // Complete the line
      const events2 = buffer.append('se","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\n');
      expect(events2).toHaveLength(1);
      expect(isPhaseEvent(events2[0])).toBe(true);
    });

    it('should handle multiple complete lines at once', () => {
      const buffer = new StreamingEventBuffer();
      
      const data = [
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"item","id":"App1","driver":"winget","status":"installing","reason":null,"timestamp":"2025-01-01T00:00:01.000Z"}',
      ].join('\n') + '\n';

      const events = buffer.append(data);
      expect(events).toHaveLength(2);
    });

    it('should handle Windows line endings (CRLF)', () => {
      const buffer = new StreamingEventBuffer();
      
      const data = '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}\r\n';
      const events = buffer.append(data);
      
      expect(events).toHaveLength(1);
      expect(isPhaseEvent(events[0])).toBe(true);
    });

    it('should flush remaining content', () => {
      const buffer = new StreamingEventBuffer();
      
      // Append without trailing newline
      buffer.append('{"version":1,"event":"phase","phase":"verify","timestamp":"2025-01-01T00:00:00.000Z"}');
      
      const event = buffer.flush();
      expect(event).not.toBeNull();
      expect(isPhaseEvent(event!)).toBe(true);
    });

    it('should return null on flush if buffer is empty', () => {
      const buffer = new StreamingEventBuffer();
      expect(buffer.flush()).toBeNull();
    });

    it('should clear buffer', () => {
      const buffer = new StreamingEventBuffer();
      buffer.append('partial data');
      buffer.clear();
      expect(buffer.getRemaining()).toBe('');
    });

    it('should skip invalid lines in buffer', () => {
      const buffer = new StreamingEventBuffer();
      
      const data = [
        '[INFO] Log message',
        '{"version":1,"event":"phase","phase":"apply","timestamp":"2025-01-01T00:00:00.000Z"}',
        'not json',
      ].join('\n') + '\n';

      const events = buffer.append(data);
      expect(events).toHaveLength(1);
    });
  });

  describe('StreamingState', () => {
    it('should create empty state', () => {
      const state = createStreamingState();
      
      expect(state.currentPhase).toBeNull();
      expect(state.items.size).toBe(0);
      expect(state.summaries.size).toBe(0);
      expect(state.errors).toHaveLength(0);
    });

    it('should apply phase event', () => {
      const state = createStreamingState();
      const event: PhaseEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const modified = applyStreamingEvent(state, event);
      
      expect(modified).toBe(true);
      expect(state.currentPhase).toBe('apply');
    });

    it('should apply item event', () => {
      const state = createStreamingState();
      const event: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'Notepad++.Notepad++',
        driver: 'winget',
        status: 'installing',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const modified = applyStreamingEvent(state, event);
      
      expect(modified).toBe(true);
      expect(state.items.size).toBe(1);
      expect(state.items.get('Notepad++.Notepad++')).toEqual(event);
    });

    it('should update item status on subsequent events', () => {
      const state = createStreamingState();
      
      const event1: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App.Id',
        driver: 'winget',
        status: 'installing',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      
      const event2: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'item',
        id: 'App.Id',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: '2025-01-01T00:00:01.000Z',
      };

      applyStreamingEvent(state, event1);
      applyStreamingEvent(state, event2);
      
      expect(state.items.size).toBe(1);
      expect(state.items.get('App.Id')?.status).toBe('installed');
    });

    it('should apply summary event', () => {
      const state = createStreamingState();
      const event: SummaryEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'summary',
        phase: 'apply',
        total: 10,
        success: 8,
        skipped: 1,
        failed: 1,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const modified = applyStreamingEvent(state, event);
      
      expect(modified).toBe(true);
      expect(state.summaries.size).toBe(1);
      expect(state.summaries.get('apply')).toEqual(event);
    });

    it('should apply error event', () => {
      const state = createStreamingState();
      const event: ErrorEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'error',
        scope: 'engine',
        message: 'Connection failed',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const modified = applyStreamingEvent(state, event);
      
      expect(modified).toBe(true);
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0]).toEqual(event);
    });

    it('should accumulate multiple errors', () => {
      const state = createStreamingState();
      
      const error1: ErrorEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'error',
        scope: 'item',
        message: 'Error 1',
        id: 'App1',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      
      const error2: ErrorEvent = {
        version: STREAMING_EVENT_VERSION,
        event: 'error',
        scope: 'item',
        message: 'Error 2',
        id: 'App2',
        timestamp: '2025-01-01T00:00:01.000Z',
      };

      applyStreamingEvent(state, error1);
      applyStreamingEvent(state, error2);
      
      expect(state.errors).toHaveLength(2);
    });
  });

  describe('type guards', () => {
    it('isPhaseEvent should correctly identify phase events', () => {
      const phaseEvent: StreamingEvent = {
        version: 1,
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const itemEvent: StreamingEvent = {
        version: 1,
        event: 'item',
        id: 'App',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isPhaseEvent(phaseEvent)).toBe(true);
      expect(isPhaseEvent(itemEvent)).toBe(false);
    });

    it('isItemEvent should correctly identify item events', () => {
      const itemEvent: StreamingEvent = {
        version: 1,
        event: 'item',
        id: 'App',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const phaseEvent: StreamingEvent = {
        version: 1,
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isItemEvent(itemEvent)).toBe(true);
      expect(isItemEvent(phaseEvent)).toBe(false);
    });

    it('isSummaryEvent should correctly identify summary events', () => {
      const summaryEvent: StreamingEvent = {
        version: 1,
        event: 'summary',
        phase: 'apply',
        total: 10,
        success: 10,
        skipped: 0,
        failed: 0,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const phaseEvent: StreamingEvent = {
        version: 1,
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isSummaryEvent(summaryEvent)).toBe(true);
      expect(isSummaryEvent(phaseEvent)).toBe(false);
    });

    it('isErrorEvent should correctly identify error events', () => {
      const errorEvent: StreamingEvent = {
        version: 1,
        event: 'error',
        scope: 'engine',
        message: 'Error',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const phaseEvent: StreamingEvent = {
        version: 1,
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isErrorEvent(errorEvent)).toBe(true);
      expect(isErrorEvent(phaseEvent)).toBe(false);
    });
  });
});
