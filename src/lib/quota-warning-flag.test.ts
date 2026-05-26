import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasSeenQuotaWarningFor,
  markQuotaWarningFor,
  clearQuotaWarningFor,
} from './quota-warning-flag';

beforeEach(() => {
  localStorage.clear();
});

describe('quota-warning-flag', () => {
  it('reports unseen for a fresh email', () => {
    expect(hasSeenQuotaWarningFor('alice@example.com')).toBe(false);
  });

  it('reports seen after marking', () => {
    markQuotaWarningFor('alice@example.com');
    expect(hasSeenQuotaWarningFor('alice@example.com')).toBe(true);
  });

  it('keys per email — Bob unaffected by Alice', () => {
    markQuotaWarningFor('alice@example.com');
    expect(hasSeenQuotaWarningFor('bob@example.com')).toBe(false);
  });

  it('case-insensitive + trimmed', () => {
    markQuotaWarningFor(' Alice@Example.COM ');
    expect(hasSeenQuotaWarningFor('alice@example.com')).toBe(true);
  });

  it('treats missing email as seen (no toast without an account)', () => {
    expect(hasSeenQuotaWarningFor(undefined)).toBe(true);
    expect(hasSeenQuotaWarningFor(null)).toBe(true);
    expect(hasSeenQuotaWarningFor('')).toBe(true);
  });

  it('clears so the warning re-fires after dropping below threshold', () => {
    markQuotaWarningFor('alice@example.com');
    expect(hasSeenQuotaWarningFor('alice@example.com')).toBe(true);
    clearQuotaWarningFor('alice@example.com');
    expect(hasSeenQuotaWarningFor('alice@example.com')).toBe(false);
  });

  it('clear with no email is a no-op (does not throw)', () => {
    clearQuotaWarningFor(undefined);
    clearQuotaWarningFor('');
    // No state to assert — just verifying no throw.
    expect(true).toBe(true);
  });
});
