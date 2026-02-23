/**
 * NDJSON Streaming Events Parser
 * 
 * Parses newline-delimited JSON events from the engine's stderr stream.
 * Events are UI-only and ephemeral - they do NOT replace the authoritative
 * stdout JSON envelope.
 * 
 * @see docs/cli-json-contract.md for the full contract
 */

/**
 * Event schema version - must match engine version
 */
export const STREAMING_EVENT_VERSION = 1;

/**
 * Engine execution phases
 */
export type EnginePhase = 'plan' | 'apply' | 'verify' | 'capture' | 'restore';

/**
 * Item status values from the engine
 * These are the canonical status values emitted by the engine.
 */
export type EngineItemStatus = 
  | 'to_install'   // Preview: will be installed
  | 'installing'   // In progress
  | 'installed'    // Successfully installed
  | 'present'      // Already on system
  | 'skipped'      // Skipped by filter/policy
  | 'failed';      // Failed

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

/**
 * Union type for all streaming events
 */
export type StreamingEvent = PhaseEvent | ItemEvent | SummaryEvent | ErrorEvent | ArtifactEvent | RestoreItemEvent;

/**
 * Type guards for event types
 */
export function isPhaseEvent(event: StreamingEvent): event is PhaseEvent {
  return event.event === 'phase';
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
    const validEventTypes = ['phase', 'item', 'summary', 'error', 'artifact', 'restore-item'];
    if (!validEventTypes.includes(parsed.event)) {
      return null;
    }

    return parsed as StreamingEvent;
  } catch {
    // Invalid JSON - silently ignore per contract
    return null;
  }
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
