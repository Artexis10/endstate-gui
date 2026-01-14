/**
 * Draft Store Tests
 * 
 * Enforces the contract for store-based capture drafts:
 * 1. Draft text is stored in localStorage (NOT as a disk file)
 * 2. Save uses draft text from store, not a file path
 * 3. After reload (loading from store), Save still works
 * 4. Missing draft text is detected without file IO
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft, hasDraft, CaptureDraft } from './draft-store';
import * as storage from './storage';

vi.mock('./storage');

describe('Draft Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveDraft', () => {
    it('stores draft text in localStorage', () => {
      const draft: CaptureDraft = {
        text: '{"apps": []}',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 5,
      };

      saveDraft(draft);

      expect(storage.setItem).toHaveBeenCalledWith(
        'endstate-capture-draft-text',
        '{"apps": []}'
      );
      expect(storage.setItem).toHaveBeenCalledWith(
        'endstate-capture-draft-created-at',
        expect.stringContaining('"createdAt":"2024-01-01T00:00:00Z"')
      );
    });

    it('does NOT write to disk (no file path in storage calls)', () => {
      const draft: CaptureDraft = {
        text: '{}',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 0,
      };

      saveDraft(draft);

      // Verify storage calls don't contain file paths
      const calls = vi.mocked(storage.setItem).mock.calls;
      for (const [key, value] of calls) {
        expect(key).not.toContain('\\');
        expect(key).not.toContain('/');
        expect(key).not.toContain('.jsonc');
        expect(value).not.toContain('draft_');
      }
    });
  });

  describe('loadDraft', () => {
    it('loads draft text from localStorage', () => {
      vi.mocked(storage.getItem).mockImplementation((key: string) => {
        if (key === 'endstate-capture-draft-text') {
          return '{"apps": ["app1", "app2"]}';
        }
        if (key === 'endstate-capture-draft-created-at') {
          return JSON.stringify({ createdAt: '2024-01-01T00:00:00Z', appCount: 2 });
        }
        return null;
      });

      const draft = loadDraft();

      expect(draft).not.toBeNull();
      expect(draft?.text).toBe('{"apps": ["app1", "app2"]}');
      expect(draft?.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(draft?.appCount).toBe(2);
    });

    it('returns null when no draft exists', () => {
      vi.mocked(storage.getItem).mockReturnValue(null);

      const draft = loadDraft();

      expect(draft).toBeNull();
    });

    it('returns null when draft text is missing but metadata exists', () => {
      vi.mocked(storage.getItem).mockImplementation((key: string) => {
        if (key === 'endstate-capture-draft-text') {
          return null;
        }
        if (key === 'endstate-capture-draft-created-at') {
          return JSON.stringify({ createdAt: '2024-01-01T00:00:00Z', appCount: 2 });
        }
        return null;
      });

      const draft = loadDraft();

      expect(draft).toBeNull();
    });
  });

  describe('clearDraft', () => {
    it('removes draft from localStorage', () => {
      clearDraft();

      expect(storage.removeItem).toHaveBeenCalledWith('endstate-capture-draft-text');
      expect(storage.removeItem).toHaveBeenCalledWith('endstate-capture-draft-created-at');
    });
  });

  describe('hasDraft', () => {
    it('returns true when draft text exists', () => {
      vi.mocked(storage.getItem).mockReturnValue('{"apps": []}');

      expect(hasDraft()).toBe(true);
    });

    it('returns false when draft text is missing', () => {
      vi.mocked(storage.getItem).mockReturnValue(null);

      expect(hasDraft()).toBe(false);
    });
  });

  describe('Reload survival', () => {
    it('draft survives simulated reload (save then load)', () => {
      // Simulate in-memory storage
      const mockStorage: Record<string, string> = {};
      vi.mocked(storage.setItem).mockImplementation((key: string, value: string) => {
        mockStorage[key] = value;
      });
      vi.mocked(storage.getItem).mockImplementation((key: string) => {
        return mockStorage[key] || null;
      });

      // Save draft
      const originalDraft: CaptureDraft = {
        text: '{"apps": ["vscode", "chrome"]}',
        createdAt: '2024-01-01T12:00:00Z',
        appCount: 2,
      };
      saveDraft(originalDraft);

      // Simulate reload by loading from store
      const loadedDraft = loadDraft();

      expect(loadedDraft).not.toBeNull();
      expect(loadedDraft?.text).toBe('{"apps": ["vscode", "chrome"]}');
      expect(loadedDraft?.appCount).toBe(2);
    });
  });

  describe('No disk file dependencies', () => {
    it('draft detection does not require file IO', () => {
      // hasDraft only checks localStorage, not disk
      vi.mocked(storage.getItem).mockReturnValue('{}');
      
      const result = hasDraft();
      
      expect(result).toBe(true);
      // Only storage.getItem should be called, no invoke() for file checks
      expect(storage.getItem).toHaveBeenCalled();
    });
  });
});
