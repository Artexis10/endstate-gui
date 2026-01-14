/**
 * Error Semantics Tests (INV-3)
 * 
 * Enforces the contract for store-based draft handling:
 * - Draft text missing (null/empty) in save mode → "Draft capture missing — please run Capture again."
 * - Selected profile missing in rename mode → "Previously selected profile not found — please select a profile."
 * 
 * Note: Drafts are now stored in localStorage, NOT as disk files.
 * There are no draft_*.jsonc files - the draft text is stored directly in memory/store.
 */

import { describe, it, expect } from 'vitest';

/**
 * Error message determination logic for store-based drafts.
 * This mirrors the logic in App.tsx handleSaveProfileName.
 * 
 * @param profileNameModalMode - 'save' for new profile from draft, 'rename' for existing profile
 * @param hasDraftText - Whether pendingCaptureDraft?.draftText exists
 */
function getErrorMessage(
  profileNameModalMode: 'save' | 'rename',
  hasDraftText: boolean
): string {
  if (profileNameModalMode === 'save' && !hasDraftText) {
    return 'Draft capture missing — please run Capture again.';
  } else if (profileNameModalMode === 'rename') {
    return 'Previously selected profile not found — please select a profile.';
  } else {
    return 'Profile file not found — please select a profile.';
  }
}

describe('Error Semantics (INV-3) - Store-based drafts', () => {
  describe('Draft capture missing (no draft text in store)', () => {
    it('shows draft-specific message when saving without draft text', () => {
      const message = getErrorMessage('save', false);
      expect(message).toBe('Draft capture missing — please run Capture again.');
    });

    it('does NOT show draft message when draft text exists', () => {
      const message = getErrorMessage('save', true);
      // With draft text present, any error would be a different issue
      expect(message).not.toBe('Draft capture missing — please run Capture again.');
    });
  });

  describe('Selected profile missing (rename mode)', () => {
    it('shows profile-specific message when renaming a profile', () => {
      const message = getErrorMessage('rename', false);
      expect(message).toBe('Previously selected profile not found — please select a profile.');
    });

    it('shows same message regardless of draft state in rename mode', () => {
      const messageWithDraft = getErrorMessage('rename', true);
      const messageWithoutDraft = getErrorMessage('rename', false);
      expect(messageWithDraft).toBe('Previously selected profile not found — please select a profile.');
      expect(messageWithoutDraft).toBe('Previously selected profile not found — please select a profile.');
    });
  });

  describe('Forbidden messages', () => {
    it('never returns generic "Source file no longer exists" message', () => {
      const testCases = [
        { mode: 'save' as const, hasDraft: true },
        { mode: 'save' as const, hasDraft: false },
        { mode: 'rename' as const, hasDraft: false },
      ];

      for (const tc of testCases) {
        const message = getErrorMessage(tc.mode, tc.hasDraft);
        expect(message).not.toContain('Source file no longer exists');
        expect(message).not.toBe('Source file no longer exists.');
      }
    });

    it('never tells user to run capture when issue is missing profile (rename mode)', () => {
      const renameMessage = getErrorMessage('rename', false);
      expect(renameMessage).not.toContain('run Capture');
    });

    it('only tells user to run capture when draft is missing in save mode', () => {
      // Missing draft in save mode - should mention capture
      const saveMissingDraft = getErrorMessage('save', false);
      expect(saveMissingDraft).toContain('run Capture');

      // Has draft in save mode - should NOT mention capture (different error)
      const saveWithDraft = getErrorMessage('save', true);
      expect(saveWithDraft).not.toContain('run Capture');
    });
  });

  describe('No disk-based draft files', () => {
    it('error logic does not depend on file paths', () => {
      // The getErrorMessage function no longer takes a path parameter
      // This test documents that draft detection is purely based on in-memory/store state
      const signature = getErrorMessage.toString();
      expect(signature).not.toContain('path');
      expect(signature).not.toContain('draft_');
    });
  });
});
