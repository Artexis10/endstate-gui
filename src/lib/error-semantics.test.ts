/**
 * Error Semantics Tests (INV-3)
 * 
 * Enforces the contract from openspec/specs/draft-and-profile-state.md:
 * - Draft cache file missing → "Draft capture missing — please run Capture again."
 * - Selected profile missing → "Previously selected profile not found — please select a profile."
 * - Generic profile missing → "Profile file not found — please select a profile."
 */

import { describe, it, expect } from 'vitest';

/**
 * Error message determination logic extracted from App.tsx handleSaveProfileName.
 * This function mirrors the logic for testability.
 */
function getErrorMessage(
  profileNameModalMode: 'save' | 'rename',
  profileNameModalPath: string,
  _hasPendingCaptureDraft: boolean
): string {
  if (profileNameModalMode === 'save' && profileNameModalPath.includes('draft_')) {
    return 'Draft capture missing — please run Capture again.';
  } else if (profileNameModalMode === 'rename') {
    return 'Previously selected profile not found — please select a profile.';
  } else {
    return 'Profile file not found — please select a profile.';
  }
}

describe('Error Semantics (INV-3)', () => {
  describe('Draft capture file missing', () => {
    it('shows draft-specific message when saving a draft file', () => {
      const message = getErrorMessage(
        'save',
        'C:\\Users\\test\\AppData\\Local\\endstate-gui\\cache\\draft_2024-01-01.jsonc',
        true
      );
      expect(message).toBe('Draft capture missing — please run Capture again.');
    });

    it('shows draft-specific message for any path containing draft_', () => {
      const message = getErrorMessage(
        'save',
        'C:\\temp\\draft_timestamp.jsonc',
        true
      );
      expect(message).toBe('Draft capture missing — please run Capture again.');
    });
  });

  describe('Selected profile missing', () => {
    it('shows profile-specific message when renaming a profile', () => {
      const message = getErrorMessage(
        'rename',
        'C:\\profiles\\myprofile.jsonc',
        false
      );
      expect(message).toBe('Previously selected profile not found — please select a profile.');
    });
  });

  describe('Generic profile missing', () => {
    it('shows generic profile message for non-draft save operations', () => {
      const message = getErrorMessage(
        'save',
        'C:\\profiles\\myprofile.jsonc',
        false
      );
      expect(message).toBe('Profile file not found — please select a profile.');
    });
  });

  describe('Forbidden messages', () => {
    it('never returns generic "Source file no longer exists" message', () => {
      const testCases = [
        { mode: 'save' as const, path: 'C:\\cache\\draft_2024.jsonc', hasDraft: true },
        { mode: 'save' as const, path: 'C:\\profiles\\test.jsonc', hasDraft: false },
        { mode: 'rename' as const, path: 'C:\\profiles\\test.jsonc', hasDraft: false },
      ];

      for (const tc of testCases) {
        const message = getErrorMessage(tc.mode, tc.path, tc.hasDraft);
        expect(message).not.toContain('Source file no longer exists');
        expect(message).not.toBe('Source file no longer exists.');
      }
    });

    it('never tells user to run capture when issue is missing profile', () => {
      // When renaming a profile that doesn't exist
      const renameMessage = getErrorMessage(
        'rename',
        'C:\\profiles\\myprofile.jsonc',
        false
      );
      expect(renameMessage).not.toContain('run Capture');

      // When saving a non-draft profile
      const saveMessage = getErrorMessage(
        'save',
        'C:\\profiles\\myprofile.jsonc',
        false
      );
      expect(saveMessage).not.toContain('run Capture');
    });
  });
});
