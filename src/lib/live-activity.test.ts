import { describe, it, expect } from 'vitest';

/**
 * Unit tests for live activity ordering and deduplication logic
 */

interface AppEvent {
  app: string;
  action: string;
  timestamp?: number;
}

/**
 * Simulates the append-semantics live activity logic used in App.tsx
 */
function processAppEvents(progressUpdates: Array<{ app: string; action: string }>): AppEvent[] {
  const appEventList: AppEvent[] = [];
  const appEventIndex = new Map<string, number>();
  
  for (const progress of progressUpdates) {
    const appEvent: AppEvent = { 
      app: progress.app, 
      action: progress.action, 
      timestamp: Date.now() 
    };
    
    const existingIndex = appEventIndex.get(progress.app);
    if (existingIndex !== undefined) {
      // Update existing entry in-place (maintains position)
      appEventList[existingIndex] = appEvent;
    } else {
      // Append new entry (stream order preserved)
      appEventIndex.set(progress.app, appEventList.length);
      appEventList.push(appEvent);
    }
  }
  
  return appEventList;
}

describe('Live Activity Logic', () => {
  it('should maintain append order for new apps', () => {
    const updates = [
      { app: 'chrome', action: 'Processing' },
      { app: 'vscode', action: 'Processing' },
      { app: 'slack', action: 'Processing' },
    ];
    
    const result = processAppEvents(updates);
    
    expect(result).toHaveLength(3);
    expect(result[0].app).toBe('chrome');
    expect(result[1].app).toBe('vscode');
    expect(result[2].app).toBe('slack');
  });
  
  it('should update existing app in-place without reordering', () => {
    const updates = [
      { app: 'chrome', action: 'Processing' },
      { app: 'vscode', action: 'Processing' },
      { app: 'slack', action: 'Processing' },
      { app: 'chrome', action: 'Installed' }, // Update chrome
    ];
    
    const result = processAppEvents(updates);
    
    expect(result).toHaveLength(3);
    expect(result[0].app).toBe('chrome');
    expect(result[0].action).toBe('Installed'); // Updated action
    expect(result[1].app).toBe('vscode');
    expect(result[2].app).toBe('slack');
  });
  
  it('should handle multiple updates to same app', () => {
    const updates = [
      { app: 'chrome', action: 'Processing' },
      { app: 'chrome', action: 'Installed' },
      { app: 'chrome', action: 'OK' }, // Final state
    ];
    
    const result = processAppEvents(updates);
    
    expect(result).toHaveLength(1);
    expect(result[0].app).toBe('chrome');
    expect(result[0].action).toBe('OK');
  });
  
  it('should maintain stream order with interleaved updates', () => {
    const updates = [
      { app: 'app1', action: 'Processing' },
      { app: 'app2', action: 'Processing' },
      { app: 'app3', action: 'Processing' },
      { app: 'app1', action: 'Installed' }, // Update app1
      { app: 'app4', action: 'Processing' }, // New app4
      { app: 'app2', action: 'OK' }, // Update app2
    ];
    
    const result = processAppEvents(updates);
    
    expect(result).toHaveLength(4);
    expect(result[0].app).toBe('app1');
    expect(result[0].action).toBe('Installed');
    expect(result[1].app).toBe('app2');
    expect(result[1].action).toBe('OK');
    expect(result[2].app).toBe('app3');
    expect(result[2].action).toBe('Processing');
    expect(result[3].app).toBe('app4'); // Newest at end
    expect(result[3].action).toBe('Processing');
  });
  
  it('should preserve last 20 items correctly', () => {
    const updates = Array.from({ length: 30 }, (_, i) => ({
      app: `app${i}`,
      action: 'Installed',
    }));
    
    const result = processAppEvents(updates);
    const last20 = result.slice(-20);
    
    expect(last20).toHaveLength(20);
    expect(last20[0].app).toBe('app10'); // First of last 20
    expect(last20[19].app).toBe('app29'); // Last item
  });
  
  it('should handle dedupe with updates in last 20 window', () => {
    const updates = [
      ...Array.from({ length: 18 }, (_, i) => ({ app: `app${i}`, action: 'Installed' })),
      { app: 'app5', action: 'Failed' }, // Update app5 (already in list)
      { app: 'app18', action: 'Processing' }, // New app
      { app: 'app19', action: 'Processing' }, // New app
    ];
    
    const result = processAppEvents(updates);
    const last20 = result.slice(-20);
    
    expect(last20).toHaveLength(20);
    expect(last20.find(e => e.app === 'app5')?.action).toBe('Failed'); // Updated
    expect(last20[18].app).toBe('app18'); // Second to last
    expect(last20[19].app).toBe('app19'); // Last (newest)
  });
});

describe('Idempotency Guard Logic', () => {
  /**
   * Simulates the idempotency guard pattern used in App.tsx
   * to prevent double-run when Apply is triggered twice quickly.
   */
  it('should prevent double-run with ref guard', () => {
    let runCount = 0;
    let isRunningRef = false;
    
    const startRun = () => {
      // Guard: if already running, ignore
      if (isRunningRef) {
        return false;
      }
      isRunningRef = true;
      runCount++;
      return true;
    };
    
    const endRun = () => {
      isRunningRef = false;
    };
    
    // First call should succeed
    expect(startRun()).toBe(true);
    expect(runCount).toBe(1);
    
    // Second call while first is running should be ignored
    expect(startRun()).toBe(false);
    expect(runCount).toBe(1); // Still 1
    
    // Third call while first is running should also be ignored
    expect(startRun()).toBe(false);
    expect(runCount).toBe(1); // Still 1
    
    // End the first run
    endRun();
    
    // Now a new run should succeed
    expect(startRun()).toBe(true);
    expect(runCount).toBe(2);
  });

  it('should handle rapid double-click scenario', () => {
    let runCount = 0;
    let isRunningRef = false;
    
    const startRun = () => {
      if (isRunningRef) return false;
      isRunningRef = true;
      runCount++;
      return true;
    };
    
    // Simulate rapid double-click (both calls happen before any async work)
    const result1 = startRun();
    const result2 = startRun();
    
    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(runCount).toBe(1); // Only one run started
  });
});
