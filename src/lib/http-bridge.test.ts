import { beforeEach, describe, expect, it, vi } from 'vitest';
import protocol from './bridge-protocol.json';

const streams = vi.hoisted(() => [] as Array<{ options: any; close: ReturnType<typeof vi.fn>; onerror: any; onmessage: any }>);
vi.mock('eventsource', () => ({ EventSource: class {
  close = vi.fn(); onerror: any; onmessage: any;
  constructor(_url: string, public options: any) { streams.push(this); }
} }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_BROWSER_BRIDGE', '1');
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  streams.length = 0;
});

describe('private bridge bootstrap', () => {
  it('removes fragment authority immediately, retains it for reload, and authenticates invokes', async () => {
    const bearer = 'ac'.repeat(32);
    window.history.replaceState(null, '', `/#endstate-bridge=${bearer}`);
    const bridge = await import('./http-bridge');
    expect(window.location.hash).toBe('');
    expect(window.sessionStorage.getItem(protocol.storageKey)).toBe(bearer);
    vi.resetModules();
    const reloaded = await import('./http-bridge');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: false }) });
    vi.stubGlobal('fetch', fetch);
    await expect(reloaded.httpInvoke('engine_is_running')).resolves.toBe(false);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${bearer}`);
    await expect(bridge.isBridgeAvailable()).resolves.toBe(true);
  });

  it('fails a bare tab before a request and explains stale authority', async () => {
    const bridge = await import('./http-bridge');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(bridge.httpInvoke('engine_is_running')).rejects.toThrow('private browser bootstrap');
    expect(fetch).not.toHaveBeenCalled();
    expect(() => bridge.httpListen('event', vi.fn())).toThrow('private browser bootstrap');
    window.sessionStorage.setItem(protocol.storageKey, 'ab'.repeat(32));
    fetch.mockResolvedValue({ status: 401 });
    await expect(bridge.httpInvoke('engine_is_running')).rejects.toThrow('private browser bootstrap');
  });

  it('authenticates event fetch, preserves payloads, retries ordinary errors, and closes on refusal or disposal', async () => {
    window.sessionStorage.setItem(protocol.storageKey, 'ad'.repeat(32));
    const { httpListen } = await import('./http-bridge');
    const handler = vi.fn();
    const dispose = httpListen('event', handler);
    const stream = streams[0];
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    stream.options.fetch(`${protocol.bridgeUrl}/events`, {});
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${'ad'.repeat(32)}`);
    stream.onmessage({ data: '{"runId":"synthetic"}' });
    expect(handler).toHaveBeenCalledWith({ payload: { runId: 'synthetic' } });
    stream.onerror({ code: 503 }); expect(stream.close).not.toHaveBeenCalled();
    stream.onerror({ code: 401 }); expect(stream.close).toHaveBeenCalledOnce();
    dispose(); expect(stream.close).toHaveBeenCalledTimes(2);
  });
});
