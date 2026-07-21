/**
 * NDJSON Streaming Events Parser
 * 
 * Parses newline-delimited JSON events from the engine's stderr stream.
 * Events are UI-only and ephemeral - they do NOT replace the authoritative
 * stdout JSON envelope.
 * 
 * @see docs/cli-json-contract.md for the full contract
 */

import type {
  ConfigInstanceEvidence,
  ConfigResolutionKind,
  ConfigTargetCandidate,
} from '../types';

/**
 * Event schema version - must match engine version
 */
export const STREAMING_EVENT_VERSION = 1;

/**
 * Engine execution phases
 */
export type EnginePhase =
  | 'plan'
  | 'apply'
  | 'verify'
  | 'capture'
  | 'restore'
  | 'backup-push'
  | 'backup-pull';

/**
 * Item status values from the engine
 * These are the canonical status values emitted by the engine.
 */
export type EngineItemStatus = 
  | 'to_install'   // Preview: will be installed
  | 'installing'   // In progress
  | 'installed'    // Successfully installed
  | 'present'      // Already on system
  | 'captured'     // Legacy engine capture success (tolerated for compatibility)
  | 'skipped'      // Skipped by filter/policy
  | 'failed';      // Failed

export type CaptureStage = 'inventory' | 'settings' | 'packaging';

/**
 * Item reason values from the engine
 */
export type EngineItemReason =
  | 'already_installed'
  | 'filtered'
  | 'filtered_runtime'
  | 'filtered_store'
  | 'sensitive_excluded'
  | 'detected'
  | 'install_failed'
  | 'missing'
  | 'manual_required'
  | null;

/**
 * Base event structure - all events have these fields
 */
export interface BaseStreamingEvent {
  version: number;
  runId: string;
  timestamp: string;
}

/**
 * Phase change event
 */
export interface PhaseEvent extends BaseStreamingEvent {
  event: 'phase';
  phase: EnginePhase;
}

/** Capture-only, stage-level progress without fabricated percentages or copy. */
export interface ProgressEvent extends BaseStreamingEvent {
  event: 'progress';
  phase: 'capture';
  stage: CaptureStage;
}

/**
 * Item progress event
 */
export interface ItemEvent extends BaseStreamingEvent {
  event: 'item';
  id: string;
  driver: string;
  status: EngineItemStatus;
  reason: EngineItemReason;
  message?: string;
  /** Friendly display name from engine (e.g., "Visual Studio Code") */
  name?: string;
}

/**
 * Summary event at end of phase
 */
export interface SummaryEvent extends BaseStreamingEvent {
  event: 'summary';
  phase: EnginePhase;
  total: number;
  success: number;
  skipped: number;
  failed: number;
}

/**
 * Error event (non-fatal allowed)
 */
export interface ErrorEvent extends BaseStreamingEvent {
  event: 'error';
  scope: 'item' | 'engine';
  message: string;
  id?: string;
}

/**
 * Artifact event (e.g., manifest saved)
 */
export interface ArtifactEvent extends BaseStreamingEvent {
  event: 'artifact';
  phase: 'capture';
  kind: 'manifest';
  path: string;
}

/**
 * Hosted-backup chunk status values from the engine.
 *
 * Push (`backup-push` phase): `uploading` -> `uploaded`, with `retrying`
 * between attempts (engine emits before the backoff sleep) and `failed`
 * on terminal error.
 * Pull (`backup-pull` phase): `downloading` -> `verified` (sha256 match) ->
 * `decrypted`, with `failed` on error. The pull path does not currently
 * retry at the chunk level so `retrying` is push-only today.
 */
export type BackupChunkStatus =
  | 'uploading'
  | 'uploaded'
  | 'downloading'
  | 'verified'
  | 'decrypted'
  | 'retrying'
  | 'failed';

/**
 * Hosted-backup chunk progress event.
 *
 * Emitted by `endstate backup push --events jsonl` and
 * `endstate backup pull --events jsonl` for each chunk transfer step.
 */
export interface BackupChunkEvent extends BaseStreamingEvent {
  event: 'backup-chunk';
  /** 0-based chunk index, or -1 for the manifest blob */
  chunkIndex: number;
  /** Total number of chunks in the version (excluding manifest) */
  totalChunks: number;
  /** Encrypted size of the chunk in bytes */
  encryptedSize: number;
  status: BackupChunkStatus;
  message?: string;
  /** 1-based current attempt number. Present only when status === 'retrying'.
   *  Old engines that don't emit retry events leave this undefined; the GUI
   *  treats the absence as "generic retry indicator". */
  attempt?: number;
  /** Inclusive upper bound on attempts. Present only when status === 'retrying'. */
  maxAttempts?: number;
  /** 1-based chunk-of-total position. Mirrors chunkIndex+1 for data chunks;
   *  omitted for the manifest chunk (chunkIndex === -1). */
  current?: number;
  /** Mirrors totalChunks for forward-compat. */
  total?: number;
}

/**
 * Restore item status values from the engine
 */
export type RestoreItemStatus =
  | 'restoring'
  | 'restored'
  | 'skipped_up_to_date'
  | 'skipped_missing_source'
  | 'failed';

/**
 * Restore item progress event
 */
export interface RestoreItemEvent extends BaseStreamingEvent {
  event: 'restore-item';
  id: string;
  module: string;
  restorer: string;
  source: string;
  target: string;
  status: RestoreItemStatus;
  reason: string | null;
  backupPath: string | null;
  targetExisted: boolean;
  message?: string;
}

/** Final compatibility/target decision emitted before config mutation. */
export interface ConfigResolutionEvent extends BaseStreamingEvent {
  event: 'config-resolution';
  captureId: string;
  moduleId: string;
  configSetId: string;
  sourceInstance?: ConfigInstanceEvidence;
  sourceInstanceId?: string;
  targetInstanceId?: string;
  targetCandidates: ConfigTargetCandidate[];
  sourceGeneration?: string;
  sourceGenerationFingerprint?: string;
  targetGeneration?: string;
  resolution: ConfigResolutionKind;
  reason: string | null;
  migrationPath: string[];
  captureModuleRevision?: string;
  restoreModuleRevision?: string;
  label: string;
  message: string;
  remediation: string | null;
}

export type ConfigMigrationStage =
  | 'staging'
  | 'edge'
  | 'validation'
  | 'commit'
  | 'rollback';

export type ConfigMigrationStatus = 'started' | 'completed' | 'failed';

/** Engine-authored, transient migration progress for one config set. */
export interface ConfigMigrationEvent extends BaseStreamingEvent {
  event: 'config-migration';
  captureId: string;
  configSetId: string;
  stage: ConfigMigrationStage;
  fromGeneration?: string;
  toGeneration?: string;
  status: ConfigMigrationStatus;
  reason: string | null;
  message: string;
  remediation: string | null;
}

export type ConfigProgressEvent = ConfigResolutionEvent | ConfigMigrationEvent;

/**
 * Union type for all streaming events
 */
export type StreamingEvent =
  | PhaseEvent
  | ProgressEvent
  | ItemEvent
  | SummaryEvent
  | ErrorEvent
  | ArtifactEvent
  | RestoreItemEvent
  | ConfigResolutionEvent
  | ConfigMigrationEvent
  | BackupChunkEvent;

/**
 * Type guards for event types
 */
export function isPhaseEvent(event: StreamingEvent): event is PhaseEvent {
  return event.event === 'phase';
}

export function isProgressEvent(event: StreamingEvent): event is ProgressEvent {
  return event.event === 'progress';
}

export function isItemEvent(event: StreamingEvent): event is ItemEvent {
  return event.event === 'item';
}

export function isSummaryEvent(event: StreamingEvent): event is SummaryEvent {
  return event.event === 'summary';
}

export function isErrorEvent(event: StreamingEvent): event is ErrorEvent {
  return event.event === 'error';
}

export function isArtifactEvent(event: StreamingEvent): event is ArtifactEvent {
  return event.event === 'artifact';
}

export function isRestoreItemEvent(event: StreamingEvent): event is RestoreItemEvent {
  return event.event === 'restore-item';
}

export function isConfigResolutionEvent(event: unknown): event is ConfigResolutionEvent {
  if (!isRecord(event) || !hasConfigEventBase(event, 'config-resolution')) return false;

  return typeof event.captureId === 'string'
    && typeof event.moduleId === 'string'
    && typeof event.configSetId === 'string'
    && isOptionalConfigInstanceEvidence(event.sourceInstance)
    && isOptionalString(event.sourceInstanceId)
    && isOptionalString(event.targetInstanceId)
    && Array.isArray(event.targetCandidates)
    && event.targetCandidates.every(isConfigTargetCandidate)
    && isOptionalString(event.sourceGeneration)
    && isOptionalString(event.sourceGenerationFingerprint)
    && isOptionalString(event.targetGeneration)
    && CONFIG_RESOLUTIONS.has(event.resolution as ConfigResolutionKind)
    && isNullableString(event.reason)
    && isStringArray(event.migrationPath)
    && isOptionalString(event.captureModuleRevision)
    && isOptionalString(event.restoreModuleRevision)
    && typeof event.label === 'string'
    && typeof event.message === 'string'
    && isNullableString(event.remediation);
}

export function isConfigMigrationEvent(event: unknown): event is ConfigMigrationEvent {
  if (!isRecord(event) || !hasConfigEventBase(event, 'config-migration')) return false;

  return typeof event.captureId === 'string'
    && typeof event.configSetId === 'string'
    && CONFIG_MIGRATION_STAGES.has(event.stage as ConfigMigrationStage)
    && isOptionalString(event.fromGeneration)
    && isOptionalString(event.toGeneration)
    && CONFIG_MIGRATION_STATUSES.has(event.status as ConfigMigrationStatus)
    && isNullableString(event.reason)
    && typeof event.message === 'string'
    && isNullableString(event.remediation);
}

export function isBackupChunkEvent(event: StreamingEvent): event is BackupChunkEvent {
  return event.event === 'backup-chunk';
}

/**
 * Parse a single NDJSON line into a StreamingEvent.
 * Returns null if the line is invalid JSON or doesn't match the schema.
 * Invalid lines are silently ignored per contract.
 */
export function parseStreamingEvent(line: string): StreamingEvent | null {
  if (!line || typeof line !== 'string') {
    return null;
  }

  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    
    // Validate required base fields
    if (typeof parsed.version !== 'number' || typeof parsed.event !== 'string') {
      return null;
    }

    // Validate version compatibility - reject unsupported versions
    if (parsed.version !== STREAMING_EVENT_VERSION) {
      console.warn(`[StreamingEvents] Unsupported event version ${parsed.version}, expected ${STREAMING_EVENT_VERSION} - skipping event`);
      return null;
    }

    // Validate event type
    const validEventTypes = [
      'phase',
      'progress',
      'item',
      'summary',
      'error',
      'artifact',
      'restore-item',
      'config-resolution',
      'config-migration',
      'backup-chunk',
    ];
    if (!validEventTypes.includes(parsed.event)) {
      return null;
    }

    // New config events cross directly into transient UI state, so validate
    // their full wire shape. Older event parsing remains intentionally
    // unchanged for backward compatibility.
    if (parsed.event === 'config-resolution' && !isConfigResolutionEvent(parsed)) {
      return null;
    }
    if (parsed.event === 'config-migration' && !isConfigMigrationEvent(parsed)) {
      return null;
    }
    // The summary event is the parse layer's only "phase completed" signal, so a
    // corrupted-but-JSON-valid summary (missing/garbage counts) must be rejected
    // rather than surfaced as a completed result the UI would read as success.
    if (parsed.event === 'summary' && !isValidSummaryShape(parsed)) {
      return null;
    }

    // Capture emits additive stage-only progress events; reject an unknown
    // stage or a non-capture phase rather than surfacing an unrecognized stage.
    if (parsed.event === 'progress') {
      const validStages: CaptureStage[] = ['inventory', 'settings', 'packaging'];
      if (parsed.phase !== 'capture' || !validStages.includes(parsed.stage)) {
        return null;
      }
    }

    // Reject item statuses outside the canonical set plus the deprecated
    // `captured` compatibility value so malformed statuses never render as
    // deliberate exclusions.
    if (parsed.event === 'item') {
      const validStatuses: EngineItemStatus[] = [
        'to_install',
        'installing',
        'installed',
        'present',
        'skipped',
        'failed',
        'captured',
      ];
      if (!validStatuses.includes(parsed.status)) {
        return null;
      }
    }

    return parsed as StreamingEvent;
  } catch {
    // Invalid JSON - silently ignore per contract
    return null;
  }
}

const CONFIG_RESOLUTIONS = new Set<ConfigResolutionKind>([
  'direct',
  'migrate',
  'incompatible',
  'unknown',
  'legacy_unverified',
]);

const CONFIG_MIGRATION_STAGES = new Set<ConfigMigrationStage>([
  'staging',
  'edge',
  'validation',
  'commit',
  'rollback',
]);

const CONFIG_MIGRATION_STATUSES = new Set<ConfigMigrationStatus>([
  'started',
  'completed',
  'failed',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every count must be present and numeric for a summary to count as terminal. */
function isValidSummaryShape(event: Record<string, unknown>): boolean {
  return typeof event.phase === 'string'
    && typeof event.total === 'number'
    && typeof event.success === 'number'
    && typeof event.skipped === 'number'
    && typeof event.failed === 'number';
}

function hasConfigEventBase(
  event: Record<string, unknown>,
  eventName: ConfigResolutionEvent['event'] | ConfigMigrationEvent['event'],
): boolean {
  return event.version === STREAMING_EVENT_VERSION
    && event.event === eventName
    && typeof event.runId === 'string'
    && typeof event.timestamp === 'string';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isConfigInstanceEvidence(value: unknown): value is ConfigInstanceEvidence {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.detectorId === 'string'
    && typeof value.rawVersion === 'string'
    && typeof value.normalizedVersion === 'string'
    && isDetectionEvidence(value.evidence);
}

function isOptionalConfigInstanceEvidence(
  value: unknown,
): value is ConfigInstanceEvidence | undefined {
  return value === undefined || isConfigInstanceEvidence(value);
}

function isConfigTargetCandidate(value: unknown): value is ConfigTargetCandidate {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.moduleId === 'string'
    && typeof value.detectorId === 'string'
    && typeof value.rawVersion === 'string'
    && typeof value.normalizedVersion === 'string'
    && isDetectionEvidence(value.evidence)
    && isOptionalString(value.targetGeneration)
    && isOptionalString(value.targetGenerationFingerprint)
    && typeof value.restoreModuleRevision === 'string';
}

function isDetectionEvidence(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  return ['appId', 'backend', 'platform', 'ref', 'driver']
    .every((key) => isOptionalString(value[key]));
}

/**
 * Parse multiple NDJSON lines into StreamingEvents.
 * Invalid lines are silently ignored.
 */
export function parseStreamingEvents(data: string): StreamingEvent[] {
  if (!data) {
    return [];
  }

  const lines = data.split('\n');
  const events: StreamingEvent[] = [];

  for (const line of lines) {
    const event = parseStreamingEvent(line);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Streaming event buffer for handling partial lines.
 * Accumulates data and yields complete events.
 */
export class StreamingEventBuffer {
  private buffer: string = '';

  /**
   * Append data to the buffer and return complete events.
   */
  append(data: string): StreamingEvent[] {
    this.buffer += data;
    const events: StreamingEvent[] = [];
    
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      
      // Trim carriage return if present (Windows line endings)
      const cleanLine = line.replace(/\r$/, '');
      const event = parseStreamingEvent(cleanLine);
      if (event) {
        events.push(event);
      }
    }
    
    return events;
  }

  /**
   * Get any remaining partial line in the buffer.
   */
  getRemaining(): string {
    return this.buffer;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = '';
  }

  /**
   * Flush any remaining content as a final event (if valid).
   */
  flush(): StreamingEvent | null {
    if (this.buffer.trim()) {
      const event = parseStreamingEvent(this.buffer);
      this.buffer = '';
      return event;
    }
    return null;
  }
}

/**
 * Streaming state tracker for UI updates.
 * Tracks current phase and item states during streaming.
 */
export interface StreamingState {
  currentPhase: EnginePhase | null;
  items: Map<string, ItemEvent>;
  restoreItems: Map<string, RestoreItemEvent>;
  summaries: Map<EnginePhase, SummaryEvent>;
  errors: ErrorEvent[];
}

/**
 * Create a new empty streaming state.
 */
export function createStreamingState(): StreamingState {
  return {
    currentPhase: null,
    items: new Map(),
    restoreItems: new Map(),
    summaries: new Map(),
    errors: [],
  };
}

/**
 * Apply a streaming event to the state.
 * Returns true if the state was modified.
 */
export function applyStreamingEvent(
  state: StreamingState,
  event: StreamingEvent
): boolean {
  if (isPhaseEvent(event)) {
    state.currentPhase = event.phase;
    return true;
  }

  if (isItemEvent(event)) {
    state.items.set(event.id, event);
    return true;
  }

  if (isSummaryEvent(event)) {
    state.summaries.set(event.phase, event);
    return true;
  }

  if (isRestoreItemEvent(event)) {
    state.restoreItems.set(event.id, event);
    return true;
  }

  if (isErrorEvent(event)) {
    state.errors.push(event);
    return true;
  }

  return false;
}

/**
 * Get items for a specific phase from the streaming state.
 * Note: Items don't have a phase field in the event schema.
 * The UI should track which items belong to which phase based on
 * when they were received relative to phase events.
 */
export function getItemsForPhase(
  state: StreamingState,
  _phase: EnginePhase
): ItemEvent[] {
  // All items are returned - phase tracking is done by the UI
  return Array.from(state.items.values());
}

/**
 * Get the latest status for an item ID.
 */
export function getItemStatus(
  state: StreamingState,
  itemId: string
): ItemEvent | undefined {
  return state.items.get(itemId);
}
