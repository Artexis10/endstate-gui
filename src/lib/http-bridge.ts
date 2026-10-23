/** Authenticated standalone transport for browser development. Tauri uses IPC. */
import { EventSource } from 'eventsource';
import protocol from './bridge-protocol.json';

const BOOTSTRAP_ERROR = 'Open the private browser bootstrap printed by npm run dev:bridge for this launch.';

function consumeBootstrap(): void {
  if (typeof window === 'undefined' || import.meta.env.VITE_BROWSER_BRIDGE !== '1') return;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has('endstate-bridge')) return;
  const bearer = fragment.get('endstate-bridge');
  // Clear authority before storage, validation, rendering, or any network request.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  // The descriptor protocol fixes a 32-byte lowercase hexadecimal bearer.
  if (bearer && /^[a-f0-9]{64}$/.test(bearer)) {
    window.sessionStorage.setItem(protocol.storageKey, bearer);
  } else {
    window.sessionStorage.removeItem(protocol.storageKey);
  }
}
consumeBootstrap();

function authorization(): string {
  const bearer = window.sessionStorage.getItem(protocol.storageKey);
  if (!bearer) throw new Error(BOOTSTRAP_ERROR);
  return `Bearer ${bearer}`;
}

export async function httpInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  const response = await fetch(`${protocol.bridgeUrl}/api/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization() },
    body: JSON.stringify({ cmd, args: args || {} }),
  });
  if (response.status === 401 || response.status === 403) throw new Error(BOOTSTRAP_ERROR);
  if (!response.ok) throw new Error(`HTTP bridge error: ${response.status} ${response.statusText}`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || `Command '${cmd}' failed`);
  return result.data as T;
}

export function httpListen<T = any>(
  _event: string,
  handler: (event: { payload: T }) => void,
): () => void {
  const credential = authorization();
  const eventSource = new EventSource(`${protocol.bridgeUrl}/events`, {
    fetch: (input, init) => fetch(input, {
      ...init, headers: { ...init?.headers, Authorization: credential },
    }),
  });
  eventSource.onmessage = (message) => {
    try {
      handler({ payload: JSON.parse(message.data) as T });
    } catch {
      // Ignore unparseable events.
    }
  };
  eventSource.onerror = (error) => {
    if (error.code === 401 || error.code === 403) {
      eventSource.close();
      console.warn(`[HTTP Bridge] ${BOOTSTRAP_ERROR}`);
    } else {
      console.warn('[HTTP Bridge] SSE connection error, will retry...');
    }
  };
  return () => eventSource.close();
}

export async function isBridgeAvailable(): Promise<boolean> {
  try {
    await httpInvoke('engine_is_running');
    return true;
  } catch {
    return false;
  }
}
