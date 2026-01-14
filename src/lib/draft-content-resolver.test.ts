/**
 * Tests for draft content resolver
 * 
 * Enforces INV-SAVE-1 and INV-SAVE-2 from OpenSpec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDraftContent, type PendingCaptureDraft } from './draft-content-resolver';
import * as draftStore from './draft-store';

vi.mock('./draft-store');

describe('resolveDraftContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('INV-SAVE-1: Never return empty content', () => {
    it('rejects empty string from in-memory draft', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 5,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '',
        apps: ['app1', 'app2'],
      };

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBeNull();
    });

    it('rejects whitespace-only string from in-memory draft', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 5,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '   \n\t  ',
        apps: ['app1', 'app2'],
      };

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBeNull();
    });

    it('rejects empty string from draft-store', async () => {
      vi.mocked(draftStore.loadDraft).mockResolvedValue({
        text: '',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 5,
      });

      const result = await resolveDraftContent(null);
      expect(result).toBeNull();
    });

    it('rejects whitespace-only string from draft-store', async () => {
      vi.mocked(draftStore.loadDraft).mockResolvedValue({
        text: '   \n\t  ',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 5,
      });

      const result = await resolveDraftContent(null);
      expect(result).toBeNull();
    });
  });

  describe('INV-SAVE-2: Content resolution order', () => {
    it('returns in-memory draft when available and non-empty', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 5,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '{"apps": ["test"]}',
        apps: ['test'],
      };

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBe('{"apps": ["test"]}');
      expect(draftStore.loadDraft).not.toHaveBeenCalled();
    });

    it('falls back to draft-store when in-memory is null', async () => {
      vi.mocked(draftStore.loadDraft).mockResolvedValue({
        text: '{"apps": ["stored"]}',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 3,
      });

      const result = await resolveDraftContent(null);
      expect(result).toBe('{"apps": ["stored"]}');
      expect(draftStore.loadDraft).toHaveBeenCalledOnce();
    });

    it('falls back to draft-store when in-memory has empty draftText', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 5,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '',
        apps: [],
      };

      vi.mocked(draftStore.loadDraft).mockResolvedValue({
        text: '{"apps": ["stored"]}',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 3,
      });

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBe('{"apps": ["stored"]}');
      expect(draftStore.loadDraft).toHaveBeenCalledOnce();
    });

    it('returns null when both sources are unavailable', async () => {
      vi.mocked(draftStore.loadDraft).mockResolvedValue(null);

      const result = await resolveDraftContent(null);
      expect(result).toBeNull();
    });

    it('returns null when both sources have empty content', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 0,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '',
        apps: [],
      };

      vi.mocked(draftStore.loadDraft).mockResolvedValue({
        text: '  ',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 0,
      });

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBeNull();
    });

    it('handles draft-store errors gracefully', async () => {
      vi.mocked(draftStore.loadDraft).mockRejectedValue(new Error('Store error'));

      const result = await resolveDraftContent(null);
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('accepts valid JSON content', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 2,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '{"apps": ["app1", "app2"]}',
        apps: ['app1', 'app2'],
      };

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBe('{"apps": ["app1", "app2"]}');
    });

    it('accepts content with leading/trailing whitespace (not trimmed)', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 1,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '  {"apps": ["test"]}  ',
        apps: ['test'],
      };

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBe('  {"apps": ["test"]}  ');
    });

    it('prefers in-memory over draft-store even if both exist', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 1,
        capturedAt: '2024-01-01T00:00:00Z',
        draftText: '{"apps": ["memory"]}',
        apps: ['memory'],
      };

      vi.mocked(draftStore.loadDraft).mockResolvedValue({
        text: '{"apps": ["store"]}',
        createdAt: '2024-01-01T00:00:00Z',
        appCount: 1,
      });

      const result = await resolveDraftContent(pendingDraft);
      expect(result).toBe('{"apps": ["memory"]}');
      expect(draftStore.loadDraft).not.toHaveBeenCalled();
    });
  });
});
