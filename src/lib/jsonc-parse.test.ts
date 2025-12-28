import { describe, it, expect } from 'vitest';
import { stripJsonComments, parseJsonc } from './jsonc-parse';

describe('jsonc-parse', () => {
  describe('stripJsonComments', () => {
    it('strips single-line comments', () => {
      const input = `{
        "name": "test" // this is a comment
      }`;
      const result = stripJsonComments(input);
      expect(result).not.toContain('// this is a comment');
      expect(result).toContain('"name": "test"');
    });

    it('strips multi-line comments', () => {
      const input = `{
        /* this is a
           multi-line comment */
        "name": "test"
      }`;
      const result = stripJsonComments(input);
      expect(result).not.toContain('multi-line comment');
      expect(result).toContain('"name": "test"');
    });

    it('preserves comments inside strings', () => {
      const input = `{
        "url": "http://example.com/path"
      }`;
      const result = stripJsonComments(input);
      expect(result).toContain('http://example.com/path');
    });

    it('handles escaped quotes in strings', () => {
      const input = `{
        "message": "He said \\"hello\\""
      }`;
      const result = stripJsonComments(input);
      expect(result).toContain('\\"hello\\"');
    });
  });

  describe('parseJsonc', () => {
    it('parses valid JSONC with comments', () => {
      const input = `{
        // Profile version
        "version": 1,
        /* Apps list */
        "apps": [
          { "id": "App.One" },
          { "id": "App.Two" }
        ]
      }`;
      const result = parseJsonc<{ version: number; apps: { id: string }[] }>(input);
      expect(result.version).toBe(1);
      expect(result.apps).toHaveLength(2);
      expect(result.apps[0].id).toBe('App.One');
    });

    it('throws on invalid JSON', () => {
      const input = `{ invalid json }`;
      expect(() => parseJsonc(input)).toThrow();
    });

    it('parses profile manifest and extracts apps', () => {
      const input = `{
        "version": 1,
        "apps": [
          { "id": "Microsoft.VSCode", "name": "Visual Studio Code" },
          { "id": "Google.Chrome" }
        ]
      }`;
      const result = parseJsonc<{ apps: { id: string; name?: string }[] }>(input);
      expect(result.apps).toHaveLength(2);
      expect(result.apps[0].name).toBe('Visual Studio Code');
      expect(result.apps[1].id).toBe('Google.Chrome');
    });
  });
});
