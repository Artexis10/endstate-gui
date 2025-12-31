/**
 * Event Replay - Reconstruct Live Activity from persisted NDJSON events
 * 
 * Reads events files from disk and replays them through the existing
 * event handler to reconstruct Live Activity state for completed runs.
 */

import { parseStreamingEvent, type StreamingEvent, isItemEvent, isPhaseEvent } from './streaming-events';
import { itemEventToAppEvent, type AppEvent, type EnginePhase } from './apply-utils';

/**
 * Read and parse events from a file path.
 * Returns array of parsed events, tolerating blank lines and invalid JSON.
 * 
 * @param fileContent - Raw file contents (NDJSON format)
 * @returns Array of parsed streaming events
 */
export function parseEventsFile(fileContent: string): StreamingEvent[] {
  if (!fileContent || typeof fileContent !== 'string') {
    return [];
  }

  const lines = fileContent.split('\n');
  const events: StreamingEvent[] = [];
  let invalidCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip blank lines
    if (!trimmed) {
      continue;
    }

    const event = parseStreamingEvent(trimmed);
    if (event) {
      events.push(event);
    } else {
      invalidCount++;
      // Only log in dev mode to avoid console spam
      if (import.meta.env.DEV && invalidCount <= 5) {
        console.debug('[event-replay] Invalid event line:', trimmed.slice(0, 100));
      }
    }
  }

  if (invalidCount > 0 && import.meta.env.DEV) {
    console.debug(`[event-replay] Skipped ${invalidCount} invalid lines`);
  }

  return events;
}

/**
 * Replay events to reconstruct Live Activity state.
 * Converts streaming events to AppEvents using the same logic as live streaming.
 * 
 * @param events - Array of streaming events from file
 * @returns Reconstructed app events and counters
 */
export function replayEvents(events: StreamingEvent[]): {
  appEvents: AppEvent[];
  counters: { installed: number; alreadyPresent: number; skipped: number; failed: number };
} {
  const appEvents: AppEvent[] = [];
  const counters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 };
  let currentPhase: EnginePhase = 'apply';

  for (const event of events) {
    // Track phase changes
    if (isPhaseEvent(event)) {
      currentPhase = event.phase;
      continue;
    }

    // Convert item events to app events
    if (isItemEvent(event)) {
      const appEvent = itemEventToAppEvent(event, currentPhase);
      appEvents.push(appEvent);

      // Update counters (only count final states)
      const statusKey = appEvent.statusKey;
      if (statusKey === 'installed') {
        counters.installed++;
      } else if (statusKey === 'present') {
        counters.alreadyPresent++;
      } else if (statusKey === 'skipped') {
        counters.skipped++;
      } else if (statusKey === 'failed') {
        counters.failed++;
      }
    }
  }

  return { appEvents, counters };
}

/**
 * Replay events with animation support.
 * Calls onProgress callback for each event to enable animated replay.
 * 
 * @param events - Array of streaming events from file
 * @param onProgress - Callback invoked for each event with current state
 * @param animated - If true, adds delay between events; if false, runs synchronously
 * @returns Promise that resolves when replay completes
 */
export async function replayEventsAnimated(
  events: StreamingEvent[],
  onProgress: (state: { appEvents: AppEvent[]; counters: { installed: number; alreadyPresent: number; skipped: number; failed: number } }) => void,
  animated: boolean = false
): Promise<void> {
  const appEvents: AppEvent[] = [];
  const counters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 };
  let currentPhase: EnginePhase = 'apply';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Track phase changes
    if (isPhaseEvent(event)) {
      currentPhase = event.phase;
      continue;
    }

    // Convert item events to app events
    if (isItemEvent(event)) {
      const appEvent = itemEventToAppEvent(event, currentPhase);
      appEvents.push(appEvent);

      // Update counters (only count final states)
      const statusKey = appEvent.statusKey;
      if (statusKey === 'installed') {
        counters.installed++;
      } else if (statusKey === 'present') {
        counters.alreadyPresent++;
      } else if (statusKey === 'skipped') {
        counters.skipped++;
      } else if (statusKey === 'failed') {
        counters.failed++;
      }

      // Notify progress
      onProgress({ appEvents: [...appEvents], counters: { ...counters } });

      // Add delay for animated mode
      if (animated && i < events.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms per event
      }
    }
  }
}
