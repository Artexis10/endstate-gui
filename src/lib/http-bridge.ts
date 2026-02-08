/**
 * HTTP Bridge for Tidewave mode.
 *
 * When running in a browser (not Tauri webview) with TIDEWAVE_ENABLED=1,
 * this module routes invoke() calls through HTTP and listen() through SSE
 * to the dev-only HTTP server running in the Tauri backend.
 */

const BRIDGE_URL = 'http://127.0.0.1:9876';

/**
 * Invoke a Tauri command via HTTP bridge.
 */
export async function httpInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  const response = await fetch(`${BRIDGE_URL}/api/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, args: args || {} }),
  });

  if (!response.ok) {
    throw new Error(`HTTP bridge error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || `Command '${cmd}' failed`);
  }

  return result.data as T;
}

/**
 * Listen to events via SSE bridge.
 * Returns an unlisten function.
 */
export function httpListen<T = any>(
  _event: string,
  handler: (event: { payload: T }) => void,
): () => void {
  const eventSource = new EventSource(`${BRIDGE_URL}/events`);

  eventSource.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as T;
      handler({ payload: data });
    } catch {
      // Ignore unparseable events
    }
  };

  eventSource.onerror = () => {
    // EventSource auto-reconnects, just log
    console.warn('[HTTP Bridge] SSE connection error, will retry...');
  };

  // Return unlisten function
  return () => eventSource.close();
}

/**
 * Check if the HTTP bridge is reachable.
 */
export async function isBridgeAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'engine_is_running', args: {} }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
