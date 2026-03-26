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
  isArtifactEvent,
  isRestoreItemEvent,
  STREAMING_EVENT_VERSION,
  type StreamingEvent,
  type PhaseEvent,
  type ItemEvent,
  type SummaryEvent,
  type ErrorEvent,
  type ArtifactEvent,
  type RestoreItemEvent,
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
        runId: 'test-run-1',
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
        runId: 'test-run-1',
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
        runId: 'test-run-1',
        event: 'item',
        id: 'App.Id',
        driver: 'winget',
        status: 'installing',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      
      const event2: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        runId: 'test-run-1',
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
        runId: 'test-run-1',
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
        runId: 'test-run-1',
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
        runId: 'test-run-1',
        event: 'error',
        scope: 'item',
        message: 'Error 1',
        id: 'App1',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      
      const error2: ErrorEvent = {
        version: STREAMING_EVENT_VERSION,
        runId: 'test-run-1',
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
        runId: 'test-run-1',
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const itemEvent: StreamingEvent = {
        version: 1,
        runId: 'test-run-1',
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
        runId: 'test-run-1',
        event: 'item',
        id: 'App',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const phaseEvent: StreamingEvent = {
        version: 1,
        runId: 'test-run-1',
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
        runId: 'test-run-1',
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
        runId: 'test-run-1',
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
        runId: 'test-run-1',
        event: 'error',
        scope: 'engine',
        message: 'Error',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const phaseEvent: StreamingEvent = {
        version: 1,
        runId: 'test-run-1',
        event: 'phase',
        phase: 'apply',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isErrorEvent(errorEvent)).toBe(true);
      expect(isErrorEvent(phaseEvent)).toBe(false);
    });

    it('isArtifactEvent should correctly identify artifact events', () => {
      const artifactEvent: StreamingEvent = {
        version: 1,
        runId: 'test-run-1',
        event: 'artifact',
        phase: 'capture',
        kind: 'manifest',
        path: 'C:\\profiles\\test.jsonc',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const phaseEvent: StreamingEvent = {
        version: 1,
        runId: 'test-run-1',
        event: 'phase',
        phase: 'capture',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isArtifactEvent(artifactEvent)).toBe(true);
      expect(isArtifactEvent(phaseEvent)).toBe(false);
    });
  });

  describe('Restore item events', () => {
    it('should parse restore-item event', () => {
      const line = '{"version":1,"event":"restore-item","id":"settings.json","module":"vscode","restorer":"copy","source":"C:\\\\profiles\\\\vscode\\\\settings.json","target":"C:\\\\Users\\\\test\\\\AppData\\\\Roaming\\\\Code\\\\User\\\\settings.json","status":"restored","reason":null,"backupPath":"C:\\\\backups\\\\settings.json.bak","targetExisted":true,"timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);

      expect(event).not.toBeNull();
      expect(isRestoreItemEvent(event!)).toBe(true);
      const restoreEvent = event as RestoreItemEvent;
      expect(restoreEvent.id).toBe('settings.json');
      expect(restoreEvent.module).toBe('vscode');
      expect(restoreEvent.restorer).toBe('copy');
      expect(restoreEvent.status).toBe('restored');
      expect(restoreEvent.backupPath).toBe('C:\\backups\\settings.json.bak');
      expect(restoreEvent.targetExisted).toBe(true);
    });

    it('should parse restore-item event with failed status', () => {
      const line = '{"version":1,"event":"restore-item","id":"config.ini","module":"git","restorer":"merge-ini","source":"C:\\\\profiles\\\\git\\\\config.ini","target":"C:\\\\Users\\\\test\\\\.gitconfig","status":"failed","reason":"merge_conflict","backupPath":null,"targetExisted":true,"timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);

      expect(event).not.toBeNull();
      const restoreEvent = event as RestoreItemEvent;
      expect(restoreEvent.status).toBe('failed');
      expect(restoreEvent.reason).toBe('merge_conflict');
      expect(restoreEvent.backupPath).toBeNull();
    });

    it('should parse restore-item event with skipped_up_to_date status', () => {
      const line = '{"version":1,"event":"restore-item","id":"keybindings.json","module":"vscode","restorer":"copy","source":"C:\\\\profiles\\\\vscode\\\\keybindings.json","target":"C:\\\\Users\\\\test\\\\AppData\\\\Roaming\\\\Code\\\\User\\\\keybindings.json","status":"skipped_up_to_date","reason":"identical","backupPath":null,"targetExisted":true,"timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);

      expect(event).not.toBeNull();
      const restoreEvent = event as RestoreItemEvent;
      expect(restoreEvent.status).toBe('skipped_up_to_date');
      expect(restoreEvent.reason).toBe('identical');
    });

    it('isRestoreItemEvent returns false for non-restore events', () => {
      const itemEvent: StreamingEvent = {
        version: 1,
        runId: 'test-run-1',
        event: 'item',
        id: 'App',
        driver: 'winget',
        status: 'installed',
        reason: null,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isRestoreItemEvent(itemEvent)).toBe(false);
    });

    it('should apply restore-item event to streaming state', () => {
      const state = createStreamingState();
      expect(state.restoreItems.size).toBe(0);

      const event: RestoreItemEvent = {
        version: STREAMING_EVENT_VERSION,
        runId: 'test-run-1',
        event: 'restore-item',
        id: 'settings.json',
        module: 'vscode',
        restorer: 'copy',
        source: 'C:\\profiles\\vscode\\settings.json',
        target: 'C:\\Users\\test\\settings.json',
        status: 'restored',
        reason: null,
        backupPath: 'C:\\backups\\settings.json.bak',
        targetExisted: true,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const modified = applyStreamingEvent(state, event);

      expect(modified).toBe(true);
      expect(state.restoreItems.size).toBe(1);
      expect(state.restoreItems.get('settings.json')).toEqual(event);
    });

    it('should update restore item on subsequent events', () => {
      const state = createStreamingState();

      const event1: RestoreItemEvent = {
        version: STREAMING_EVENT_VERSION,
        runId: 'test-run-1',
        event: 'restore-item',
        id: 'settings.json',
        module: 'vscode',
        restorer: 'copy',
        source: 'src',
        target: 'dst',
        status: 'restoring',
        reason: null,
        backupPath: null,
        targetExisted: false,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const event2: RestoreItemEvent = {
        ...event1,
        status: 'restored',
        backupPath: 'C:\\backups\\settings.json.bak',
        timestamp: '2025-01-01T00:00:01.000Z',
      };

      applyStreamingEvent(state, event1);
      applyStreamingEvent(state, event2);

      expect(state.restoreItems.size).toBe(1);
      expect(state.restoreItems.get('settings.json')?.status).toBe('restored');
    });
  });

  describe('Capture phase events', () => {
    it('should parse capture phase event', () => {
      const line = '{"version":1,"event":"phase","phase":"capture","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isPhaseEvent(event!)).toBe(true);
      expect((event as PhaseEvent).phase).toBe('capture');
    });

    it('should parse capture item event with detected reason', () => {
      const line = '{"version":1,"event":"item","id":"Git.Git","driver":"winget","status":"present","reason":"detected","message":"Detected","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isItemEvent(event!)).toBe(true);
      const itemEvent = event as ItemEvent;
      expect(itemEvent.id).toBe('Git.Git');
      expect(itemEvent.status).toBe('present');
      expect(itemEvent.reason).toBe('detected');
    });

    it('should parse capture item event with filtered_runtime reason', () => {
      const line = '{"version":1,"event":"item","id":"Microsoft.VCRedist.2019.x64","driver":"winget","status":"skipped","reason":"filtered_runtime","message":"Excluded (runtime)","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      const itemEvent = event as ItemEvent;
      expect(itemEvent.status).toBe('skipped');
      expect(itemEvent.reason).toBe('filtered_runtime');
    });

    it('should parse capture item event with filtered_store reason', () => {
      const line = '{"version":1,"event":"item","id":"9NBLGGH4NNS1","driver":"msstore","status":"skipped","reason":"filtered_store","message":"Excluded (store app)","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      const itemEvent = event as ItemEvent;
      expect(itemEvent.status).toBe('skipped');
      expect(itemEvent.reason).toBe('filtered_store');
    });

    it('should parse capture item event with sensitive_excluded reason', () => {
      const line = '{"version":1,"event":"item","id":"C:\\\\Users\\\\test\\\\.ssh","driver":"fs","status":"skipped","reason":"sensitive_excluded","message":"Sensitive excluded","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      const itemEvent = event as ItemEvent;
      expect(itemEvent.status).toBe('skipped');
      expect(itemEvent.reason).toBe('sensitive_excluded');
      expect(itemEvent.driver).toBe('fs');
    });

    it('should parse artifact event for manifest saved', () => {
      const line = '{"version":1,"event":"artifact","phase":"capture","kind":"manifest","path":"C:\\\\profiles\\\\test.jsonc","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isArtifactEvent(event!)).toBe(true);
      const artifactEvent = event as ArtifactEvent;
      expect(artifactEvent.phase).toBe('capture');
      expect(artifactEvent.kind).toBe('manifest');
      expect(artifactEvent.path).toBe('C:\\profiles\\test.jsonc');
    });

    it('should parse capture summary event', () => {
      const line = '{"version":1,"event":"summary","phase":"capture","total":15,"success":12,"skipped":3,"failed":0,"timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);
      
      expect(event).not.toBeNull();
      expect(isSummaryEvent(event!)).toBe(true);
      const summaryEvent = event as SummaryEvent;
      expect(summaryEvent.phase).toBe('capture');
      expect(summaryEvent.total).toBe(15);
      expect(summaryEvent.success).toBe(12);
      expect(summaryEvent.skipped).toBe(3);
      expect(summaryEvent.failed).toBe(0);
    });

    it('should parse complete capture NDJSON stream', () => {
      const data = [
        '{"version":1,"event":"phase","phase":"capture","timestamp":"2025-01-01T00:00:00.000Z"}',
        '{"version":1,"event":"item","id":"Git.Git","driver":"winget","status":"present","reason":"detected","message":"Detected","timestamp":"2025-01-01T00:00:01.000Z"}',
        '{"version":1,"event":"item","id":"Microsoft.VCRedist.2019.x64","driver":"winget","status":"skipped","reason":"filtered_runtime","message":"Excluded (runtime)","timestamp":"2025-01-01T00:00:02.000Z"}',
        '{"version":1,"event":"item","id":"C:\\\\Users\\\\test\\\\.ssh","driver":"fs","status":"skipped","reason":"sensitive_excluded","message":"Sensitive excluded","timestamp":"2025-01-01T00:00:03.000Z"}',
        '{"version":1,"event":"artifact","phase":"capture","kind":"manifest","path":"C:\\\\profiles\\\\test.jsonc","timestamp":"2025-01-01T00:00:04.000Z"}',
        '{"version":1,"event":"summary","phase":"capture","total":3,"success":1,"skipped":2,"failed":0,"timestamp":"2025-01-01T00:00:05.000Z"}',
      ].join('\n');

      const events = parseStreamingEvents(data);
      
      expect(events).toHaveLength(6);
      expect(isPhaseEvent(events[0])).toBe(true);
      expect((events[0] as PhaseEvent).phase).toBe('capture');
      expect(isItemEvent(events[1])).toBe(true);
      expect((events[1] as ItemEvent).reason).toBe('detected');
      expect(isItemEvent(events[2])).toBe(true);
      expect((events[2] as ItemEvent).reason).toBe('filtered_runtime');
      expect(isItemEvent(events[3])).toBe(true);
      expect((events[3] as ItemEvent).reason).toBe('sensitive_excluded');
      expect(isArtifactEvent(events[4])).toBe(true);
      expect(isSummaryEvent(events[5])).toBe(true);
      expect((events[5] as SummaryEvent).phase).toBe('capture');
    });
  });

  describe('Manual app events', () => {
    it('should parse item event with driver=manual', () => {
      const line = '{"version":1,"event":"item","id":"custom-tool","driver":"manual","status":"skipped","reason":"manual_required","message":"Manual installation required","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);

      expect(event).not.toBeNull();
      expect(isItemEvent(event!)).toBe(true);
      const itemEvent = event as ItemEvent;
      expect(itemEvent.id).toBe('custom-tool');
      expect(itemEvent.driver).toBe('manual');
      expect(itemEvent.status).toBe('skipped');
      expect(itemEvent.reason).toBe('manual_required');
    });

    it('should parse present manual app (already installed)', () => {
      const line = '{"version":1,"event":"item","id":"custom-tool","driver":"manual","status":"present","reason":"already_installed","message":"Verified installed","timestamp":"2025-01-01T00:00:00.000Z"}';
      const event = parseStreamingEvent(line);

      expect(event).not.toBeNull();
      const itemEvent = event as ItemEvent;
      expect(itemEvent.driver).toBe('manual');
      expect(itemEvent.status).toBe('present');
      expect(itemEvent.reason).toBe('already_installed');
    });

    it('should apply manual item event to streaming state', () => {
      const state = createStreamingState();
      const event: ItemEvent = {
        version: STREAMING_EVENT_VERSION,
        runId: 'test-run-1',
        event: 'item',
        id: 'custom-tool',
        driver: 'manual',
        status: 'skipped',
        reason: 'manual_required',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      const modified = applyStreamingEvent(state, event);

      expect(modified).toBe(true);
      expect(state.items.size).toBe(1);
      expect(state.items.get('custom-tool')?.driver).toBe('manual');
      expect(state.items.get('custom-tool')?.reason).toBe('manual_required');
    });
  });
});
