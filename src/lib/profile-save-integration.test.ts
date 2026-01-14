import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveProfileMetadata } from './profile-metadata';
import { resolveDraftContent } from './draft-content-resolver';
import type { PendingCaptureDraft } from './draft-content-resolver';

/**
 * Integration tests for Save Profile flow
 * 
 * These tests verify the complete save flow including:
 * 1. Draft content resolution
 * 2. Manifest write to .jsonc
 * 3. Metadata write to .meta.json
 * 4. Correct file paths and content separation
 */

// Mock tauri-bridge
vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  getProfilesDirectory: vi.fn(async () => 'C:\\profiles'),
  ensureDirectory: vi.fn(async () => {}),
  openFolder: vi.fn(async () => ({ ok: true })),
}));

describe('Profile Save Integration', () => {
  let mockInvoke: any;
  let writeCalls: Array<{ cmd: string; args: any }>;

  beforeEach(async () => {
    writeCalls = [];
    const { invoke } = await import('./tauri-bridge');
    mockInvoke = invoke as any;
    
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      writeCalls.push({ cmd, args });
      
      if (cmd === 'write_text_file') {
        return;
      }
      if (cmd === 'check_file_exists') {
        return false;
      }
      if (cmd === 'read_text_file') {
        return '{}';
      }
      return null;
    });
  });

  describe('Complete save flow', () => {
    it('writes manifest to .jsonc and metadata to .meta.json in correct order', async () => {
      // Setup: Create a draft with manifest content
      const manifestContent = JSON.stringify({
        name: 'Test Profile',
        version: 1,
        apps: [
          { id: 'app1', source: 'winget' },
          { id: 'app2', source: 'winget' },
        ],
      }, null, 2);

      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 2,
        capturedAt: new Date().toISOString(),
        draftText: manifestContent,
        apps: ['app1', 'app2'],
      };

      // Step 1: Resolve draft content
      const draftContent = await resolveDraftContent(pendingDraft);
      expect(draftContent).not.toBeNull();
      expect(draftContent).toBe(manifestContent);

      // Step 2: Write manifest to .jsonc
      const destPath = 'C:\\profiles\\test.jsonc';
      await mockInvoke('write_text_file', { path: destPath, content: draftContent });

      // Step 3: Write metadata to .meta.json
      const displayName = 'My Test Profile';
      await saveProfileMetadata(destPath, { displayName });

      // Verify: Two write calls were made
      const writes = writeCalls.filter(c => c.cmd === 'write_text_file');
      expect(writes).toHaveLength(2);

      // Verify: First write is manifest to .jsonc
      expect(writes[0].args.path).toBe('C:\\profiles\\test.jsonc');
      expect(writes[0].args.content).toContain('"apps"');
      expect(writes[0].args.content).toContain('"version"');
      expect(writes[0].args.content).not.toContain('"displayName"');

      // Verify: Second write is metadata to .meta.json
      expect(writes[1].args.path).toBe('C:\\profiles\\test.meta.json');
      expect(writes[1].args.content).toContain('"displayName"');
      expect(writes[1].args.content).not.toContain('"apps"');
      expect(writes[1].args.content).not.toContain('"version"');
    });

    it('handles 0 apps capture correctly', async () => {
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

      const destPath = 'C:\\profiles\\empty.jsonc';
      await mockInvoke('write_text_file', { path: destPath, content: draftContent });

      const writes = writeCalls.filter(c => c.cmd === 'write_text_file');
      expect(writes).toHaveLength(1);
      expect(writes[0].args.content).toContain('"apps"');
      expect(writes[0].args.content).toContain('[]');
      
      // Verify it's valid JSON
      const parsed = JSON.parse(writes[0].args.content);
      expect(parsed.apps).toEqual([]);
    });

    it('does not write files when draft is missing', async () => {
      const pendingDraft: PendingCaptureDraft | null = null;

      const draftContent = await resolveDraftContent(pendingDraft);
      expect(draftContent).toBeNull();

      // Should not proceed to write
      const writes = writeCalls.filter(c => c.cmd === 'write_text_file');
      expect(writes).toHaveLength(0);
    });

    it('does not write files when draft is empty string', async () => {
      const pendingDraft: PendingCaptureDraft = {
        capturedAppsCount: 0,
        capturedAt: new Date().toISOString(),
        draftText: '',
        apps: [],
      };

      const draftContent = await resolveDraftContent(pendingDraft);
      expect(draftContent).toBeNull();

      // Should not proceed to write
      const writes = writeCalls.filter(c => c.cmd === 'write_text_file');
      expect(writes).toHaveLength(0);
    });
  });

  describe('File path validation', () => {
    it('writes to correct paths with proper extensions', async () => {
      const manifestContent = JSON.stringify({ name: 'Test', version: 1, apps: [] }, null, 2);
      const destPath = 'C:\\profiles\\my_profile.jsonc';

      await mockInvoke('write_text_file', { path: destPath, content: manifestContent });
      await saveProfileMetadata(destPath, { displayName: 'My Profile' });

      const writes = writeCalls.filter(c => c.cmd === 'write_text_file');
      
      // Manifest path
      expect(writes[0].args.path).toBe('C:\\profiles\\my_profile.jsonc');
      
      // Metadata path (should have .meta.json extension)
      expect(writes[1].args.path).toBe('C:\\profiles\\my_profile.meta.json');
    });
  });
});
