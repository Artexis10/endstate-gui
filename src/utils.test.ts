import { describe, it, expect } from 'vitest';
import { stripAnsi } from './utils';

describe('utils', () => {
  describe('stripAnsi', () => {
    it('removes ANSI color codes', () => {
      const input = '\x1b[31mRed text\x1b[0m';
      const expected = 'Red text';
      expect(stripAnsi(input)).toBe(expected);
    });

    it('removes multiple ANSI sequences', () => {
      const input = '\x1b[1m\x1b[31mBold red\x1b[0m\x1b[32m Green\x1b[0m';
      const expected = 'Bold red Green';
      expect(stripAnsi(input)).toBe(expected);
    });

    it('removes cursor movement codes', () => {
      const input = '\x1b[2J\x1b[H\x1b[3JCleared screen';
      const expected = 'Cleared screen';
      expect(stripAnsi(input)).toBe(expected);
    });

    it('handles text without ANSI codes', () => {
      const input = 'Plain text';
      expect(stripAnsi(input)).toBe(input);
    });

    it('handles empty string', () => {
      expect(stripAnsi('')).toBe('');
    });

    it('removes PowerShell error formatting', () => {
      const input = '\x1b[91mOut-File: \x1b[0mCannot find path';
      const expected = 'Out-File: Cannot find path';
      expect(stripAnsi(input)).toBe(expected);
    });
  });
});
