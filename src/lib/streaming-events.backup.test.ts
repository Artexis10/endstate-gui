/**
 * Type-guard tests for the new hosted-backup streaming events.
 *
 * The phase / status enum extensions are covered indirectly elsewhere; this
 * file pins the new event variant and `isBackupChunkEvent` guard.
 */

import { describe, expect, it } from 'vitest';
import {
  isBackupChunkEvent,
  isPhaseEvent,
  parseStreamingEvent,
  STREAMING_EVENT_VERSION,
} from './streaming-events';
import type {
  BackupChunkEvent,
  StreamingEvent,
} from './streaming-events';

const baseFields = {
  version: STREAMING_EVENT_VERSION,
  runId: 'run-test-1',
  timestamp: '2026-05-10T00:00:00Z',
};

describe('streaming-events: backup additions', () => {
  it('isBackupChunkEvent narrows to BackupChunkEvent', () => {
    const event: StreamingEvent = {
      ...baseFields,
      event: 'backup-chunk',
      chunkIndex: 0,
      totalChunks: 5,
      encryptedSize: 1024,
      status: 'uploading',
    };
    expect(isBackupChunkEvent(event)).toBe(true);
    if (isBackupChunkEvent(event)) {
      const chunk: BackupChunkEvent = event;
      expect(chunk.status).toBe('uploading');
    }
  });

  it('isBackupChunkEvent rejects non-backup events', () => {
    const phase: StreamingEvent = {
      ...baseFields,
      event: 'phase',
      phase: 'apply',
    };
    expect(isBackupChunkEvent(phase)).toBe(false);
    expect(isPhaseEvent(phase)).toBe(true);
  });

  it('parseStreamingEvent accepts backup-chunk events', () => {
    const line = JSON.stringify({
      ...baseFields,
      event: 'backup-chunk',
      chunkIndex: 3,
      totalChunks: 10,
      encryptedSize: 2048,
      status: 'uploaded',
    });
    const parsed = parseStreamingEvent(line);
    expect(parsed?.event).toBe('backup-chunk');
    if (parsed && isBackupChunkEvent(parsed)) {
      expect(parsed.chunkIndex).toBe(3);
      expect(parsed.status).toBe('uploaded');
    }
  });

  it('parseStreamingEvent accepts the new backup-push and backup-pull phases', () => {
    const push = parseStreamingEvent(
      JSON.stringify({ ...baseFields, event: 'phase', phase: 'backup-push' }),
    );
    expect(push?.event).toBe('phase');
    if (push && isPhaseEvent(push)) expect(push.phase).toBe('backup-push');

    const pull = parseStreamingEvent(
      JSON.stringify({ ...baseFields, event: 'phase', phase: 'backup-pull' }),
    );
    expect(pull?.event).toBe('phase');
    if (pull && isPhaseEvent(pull)) expect(pull.phase).toBe('backup-pull');
  });

  it('parseStreamingEvent rejects unknown event types', () => {
    const bogus = parseStreamingEvent(
      JSON.stringify({ ...baseFields, event: 'cobblers', payload: 1 }),
    );
    expect(bogus).toBeNull();
  });
});
