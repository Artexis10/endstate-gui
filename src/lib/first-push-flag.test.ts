import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasRecordedFirstPush, hasSeenFirstPushFor, markFirstPushFor } from './first-push-flag';
import { clearAllKnownKeys } from './storage';

beforeEach(() => {
  // The KNOWN_KEYS list doesn't include first-push-done:* entries, so wipe
  // localStorage broadly to keep tests isolated.
  localStorage.clear();
  clearAllKnownKeys();
});

describe('first-push-flag', () => {
  it('reports unseen for a fresh email', () => {
    expect(hasSeenFirstPushFor('alice@example.com')).toBe(false);
  });

  it('reports seen after marking', () => {
    markFirstPushFor('alice@example.com');
    expect(hasSeenFirstPushFor('alice@example.com')).toBe(true);
    expect(hasRecordedFirstPush()).toBe(true);
  });

  it('reports no prior push before any account has a marker', () => {
    expect(hasRecordedFirstPush()).toBe(false);
  });

  it.each([
    ['length', () => vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => { throw new Error('storage denied'); })],
    ['key', () => vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('storage denied'); })],
    ['getItem', () => vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied'); })],
  ])('treats denied localStorage %s access as prior managed use', (_operation, denyStorage) => {
    const denied = denyStorage();
    try {
      // Unknown storage state must suppress the invitation, never crash the
      // otherwise free local application.
      expect(hasRecordedFirstPush()).toBe(true);
    } finally {
      denied.mockRestore();
    }
  });

  it('keys per email — Bob is unaffected by Alice', () => {
    markFirstPushFor('alice@example.com');
    expect(hasSeenFirstPushFor('bob@example.com')).toBe(false);
  });

  it('treats email comparison as case-insensitive and trims whitespace', () => {
    markFirstPushFor(' Alice@Example.COM ');
    expect(hasSeenFirstPushFor('alice@example.com')).toBe(true);
  });

  it('reports seen for empty/undefined input (so we never celebrate without an email)', () => {
    expect(hasSeenFirstPushFor(undefined)).toBe(true);
    expect(hasSeenFirstPushFor(null)).toBe(true);
    expect(hasSeenFirstPushFor('')).toBe(true);
  });

  it('mark with empty email is a no-op', () => {
    markFirstPushFor(undefined);
    markFirstPushFor('');
    expect(hasSeenFirstPushFor('alice@example.com')).toBe(false);
  });
});
