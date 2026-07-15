import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';

import { subscribeToClaimIntents } from './claim-intent-source';

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  getCurrent: vi.fn(),
  onOpenUrl: vi.fn(),
}));

const TOKEN = 'A'.repeat(43);
const VALID_URL = `endstate://claim?token=${TOKEN}`;
const getCurrentMock = vi.mocked(getCurrent);
const onOpenUrlMock = vi.mocked(onOpenUrl);

describe('subscribeToClaimIntents', () => {
  beforeEach(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    getCurrentMock.mockReset();
    onOpenUrlMock.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('delivers valid cold-start URLs and ignores invalid ones', async () => {
    const onIntent = vi.fn();
    const unlisten = vi.fn();
    onOpenUrlMock.mockResolvedValue(unlisten);
    getCurrentMock.mockResolvedValue([VALID_URL, 'endstate://claim?token=invalid']);

    const unsubscribe = await subscribeToClaimIntents(onIntent);

    expect(onIntent).toHaveBeenCalledOnce();
    expect(onIntent).toHaveBeenCalledWith({ type: 'claim', token: TOKEN });
    unsubscribe();
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it('delivers valid warm URLs from the deep-link listener', async () => {
    const onIntent = vi.fn();
    let openUrlHandler: ((urls: string[]) => void) | undefined;
    onOpenUrlMock.mockImplementation(async (handler) => {
      openUrlHandler = handler;
      const unlisten: () => void = vi.fn();
      return unlisten;
    });
    getCurrentMock.mockResolvedValue(null);

    await subscribeToClaimIntents(onIntent);
    openUrlHandler?.(['endstate://other', VALID_URL]);

    expect(onIntent).toHaveBeenCalledOnce();
    expect(onIntent).toHaveBeenCalledWith({ type: 'claim', token: TOKEN });
  });

  it('registers the warm listener before reading cold-start URLs', async () => {
    const calls: string[] = [];
    onOpenUrlMock.mockImplementation(async () => {
      calls.push('onOpenUrl');
      return () => {};
    });
    getCurrentMock.mockImplementation(async () => {
      calls.push('getCurrent');
      return null;
    });

    await subscribeToClaimIntents(vi.fn());

    expect(calls).toEqual(['onOpenUrl', 'getCurrent']);
  });

  it('unlistens when reading cold-start URLs fails', async () => {
    const unlisten = vi.fn();
    onOpenUrlMock.mockResolvedValue(unlisten);
    getCurrentMock.mockRejectedValue(new Error('cold-start unavailable'));

    await expect(subscribeToClaimIntents(vi.fn())).rejects.toThrow(
      'cold-start unavailable',
    );
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it('does not load native deep-link state in the web runtime', async () => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    const onIntent = vi.fn();

    const unsubscribe = await subscribeToClaimIntents(onIntent);

    expect(getCurrentMock).not.toHaveBeenCalled();
    expect(onOpenUrlMock).not.toHaveBeenCalled();
    expect(onIntent).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });
});
