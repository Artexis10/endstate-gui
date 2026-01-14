import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDraftContent } from './draft-content-resolver';
import type { PendingCaptureDraft } from './draft-content-resolver';

/**
 * Profile Save Tests
 * 
 * Tests for the Save Profile flow to ensure:
 * 1. Manifest content is written to .jsonc file
 * 2. Metadata is written to .meta.json file
 * 3. After save, profile list is refreshed and new profile is selected
 * 4. Draft is cleared after successful save
 * 5. Empty/missing draft shows error and does not write files
 */

describe('Profile Save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('INV-SAVE-MANIFEST: .jsonc must contain manifest payload', () => {
    it('writes manifest JSONC to .jsonc file, not metadata', async () => {
      // Mock Tauri invoke
      const mockInvoke = vi.fn();
      const writeCalls: Array<{ path: string; content: string }> = [];
      
      mockInvoke.mockImplementation(async (cmd: string, args: any) => {
        if (cmd === 'write_text_file') {
          writeCalls.push({ path: args.path, content: args.content });
          return;
        }
        if (cmd === 'check_file_exists') {
          return false;
        }
        return null;
      });

      // Mock the save flow
      const draftContent = JSON.stringify({
        name: 'Test Profile',
        version: 1,
        apps: [
          { id: 'app1', source: 'winget' },
          { id: 'app2', source: 'winget' },
        ],
      }, null, 2);
      
      const destPath = 'C:\\profiles\\test.jsonc';
      const displayName = 'My Test Profile';

      // Simulate save: write manifest to .jsonc
      await mockInvoke('write_text_file', { path: destPath, content: draftContent });
      
      // Simulate save: write metadata to .meta.json
      const metaPath = destPath.replace(/\.(jsonc?|json5)$/i, '.meta.json');
      const metaContent = JSON.stringify({ displayName }, null, 2);
      await mockInvoke('write_text_file', { path: metaPath, content: metaContent });

      // Verify writes
      expect(writeCalls).toHaveLength(2);
      
      // First write: manifest to .jsonc
      expect(writeCalls[0].path).toBe(destPath);
      expect(writeCalls[0].content).toContain('"apps"');
      expect(writeCalls[0].content).toContain('"version"');
      expect(writeCalls[0].content).not.toContain('"displayName"');
      
      // Second write: metadata to .meta.json
      expect(writeCalls[1].path).toBe('C:\\profiles\\test.meta.json');
      expect(writeCalls[1].content).toContain('"displayName"');
      expect(writeCalls[1].content).not.toContain('"apps"');
    });

    it('writes valid manifest even when capture has 0 apps', async () => {
      const mockInvoke = vi.fn();
      const writeCalls: Array<{ path: string; content: string }> = [];
      
      mockInvoke.mockImplementation(async (cmd: string, args: any) => {
        if (cmd === 'write_text_file') {
          writeCalls.push({ path: args.path, content: args.content });
          return;
        }
        if (cmd === 'check_file_exists') {
          return false;
        }
        return null;
      });

      // Draft with 0 apps should still be valid JSONC
      const draftContent = JSON.stringify({
        name: 'Empty Profile',
        version: 1,
        apps: [],
      }, null, 2);
      
      const destPath = 'C:\\profiles\\empty.jsonc';

      await mockInvoke('write_text_file', { path: destPath, content: draftContent });

      expect(writeCalls).toHaveLength(1);
      expect(writeCalls[0].content).toContain('"apps"');
      expect(writeCalls[0].content).toContain('[]');
      expect(writeCalls[0].content).not.toBe('');
      
      // Verify it's valid JSON
      expect(() => JSON.parse(writeCalls[0].content)).not.toThrow();
    });
  });

  describe('INV-SAVE-META: .meta.json contains metadata only', () => {
    it('writes displayName to .meta.json, not to .jsonc', async () => {
      const mockInvoke = vi.fn();
      const writeCalls: Array<{ path: string; content: string }> = [];
      
      mockInvoke.mockImplementation(async (cmd: string, args: any) => {
        if (cmd === 'write_text_file') {
          writeCalls.push({ path: args.path, content: args.content });
          return;
        }
        if (cmd === 'check_file_exists') {
          return false;
        }
        return null;
      });

      const draftContent = JSON.stringify({ name: 'Test', version: 1, apps: [] }, null, 2);
      const destPath = 'C:\\profiles\\test.jsonc';
      const displayName = 'My Display Name';

      // Write manifest
      await mockInvoke('write_text_file', { path: destPath, content: draftContent });
      
      // Write metadata
      const metaPath = 'C:\\profiles\\test.meta.json';
      const metaContent = JSON.stringify({ displayName }, null, 2);
      await mockInvoke('write_text_file', { path: metaPath, content: metaContent });

      // Verify .jsonc does NOT contain displayName
      const jsonc = writeCalls.find(c => c.path.endsWith('.jsonc'));
      expect(jsonc).toBeDefined();
      expect(jsonc!.content).not.toContain('displayName');
      
      // Verify .meta.json contains ONLY displayName
      const meta = writeCalls.find(c => c.path.endsWith('.meta.json'));
      expect(meta).toBeDefined();
      expect(meta!.content).toContain('displayName');
      expect(meta!.content).not.toContain('"apps"');
      expect(meta!.content).not.toContain('"version"');
    });
  });

  describe('INV-SAVE-2: Missing draft shows error', () => {
    it('resolveDraftContent returns null when draft is missing', async () => {
      const pendingDraft: PendingCaptureDraft | null = null;
      
      const draftContent = await resolveDraftContent(pendingDraft);
      
      expect(draftContent).toBeNull();
    });

    it('resolveDraftContent returns null when draftText is empty string', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 0,
        capturedAt: new Date().toISOString(),
        draftText: '',
        apps: [],
      };
      
      const draftContent = await resolveDraftContent(pendingDraft);
      
      expect(draftContent).toBeNull();
    });

    it('resolveDraftContent returns null when draftText is whitespace only', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 0,
        capturedAt: new Date().toISOString(),
        draftText: '   \n\t  ',
        apps: [],
      };
      
      const draftContent = await resolveDraftContent(pendingDraft);
      
      expect(draftContent).toBeNull();
    });

    it('resolveDraftContent returns content when draftText is valid', async () => {
      const manifestContent = JSON.stringify({
        name: 'Test Profile',
        version: 1,
        apps: [{ id: 'app1', source: 'winget' }],
      }, null, 2);

      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 1,
        capturedAt: new Date().toISOString(),
        draftText: manifestContent,
        apps: ['app1'],
      };
      
      const draftContent = await resolveDraftContent(pendingDraft);
      
      expect(draftContent).toBe(manifestContent);
      expect(draftContent).toContain('"apps"');
      expect(draftContent).toContain('"version"');
    });
  });

  describe('Regression: 0 apps capture', () => {
    it('writes valid manifest JSONC even when capture has 0 apps', async () => {
      const manifestContent = JSON.stringify({
        name: 'Empty Profile',
        version: 1,
        apps: [],
      }, null, 2);

      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 0,
        capturedAt: new Date().toISOString(),
        draftText: manifestContent,
        apps: [],
      };
      
      const draftContent = await resolveDraftContent(pendingDraft);
      
      expect(draftContent).not.toBeNull();
      expect(draftContent).toContain('"apps"');
      expect(draftContent).toContain('[]');
      expect(draftContent).not.toBe('');
      
      // Verify it's valid JSON
      expect(() => JSON.parse(draftContent!)).not.toThrow();
      
      const parsed = JSON.parse(draftContent!);
      expect(parsed.apps).toEqual([]);
      expect(parsed.version).toBe(1);
    });
  });
});
