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

/**
 * Capture Error Code Tests (INV-CAPTURE-3)
 * 
 * Tests for the capture artifact contract error code handling.
 * GUI must surface specific, actionable messages for known error codes.
 */
describe('Capture Error Codes (INV-CAPTURE-3)', () => {
  /**
   * Maps engine error codes to user-facing messages.
   * This mirrors the logic in App.tsx handleCaptureFromOverview.
   */
  function getCaptureErrorMessage(
    errorCode: string | undefined,
    errorMessage: string | undefined,
    errorHint: string | undefined
  ): string {
    if (errorCode === 'ENGINE_CLI_NOT_FOUND') {
      return errorHint || 'Engine CLI not found. Configure Engine path in Settings.';
    }
    return errorMessage || 'Capture failed';
  }

  describe('ENGINE_CLI_NOT_FOUND error code', () => {
    it('uses hint when ENGINE_CLI_NOT_FOUND and hint is provided', () => {
      const message = getCaptureErrorMessage(
        'ENGINE_CLI_NOT_FOUND',
        'Engine CLI not found at path: C:\\nonexistent\\cli.ps1',
        'Verify repo root is configured correctly or configure Engine path in Settings.'
      );
      expect(message).toBe('Verify repo root is configured correctly or configure Engine path in Settings.');
    });

    it('uses default message when ENGINE_CLI_NOT_FOUND and no hint', () => {
      const message = getCaptureErrorMessage(
        'ENGINE_CLI_NOT_FOUND',
        'Engine CLI not found',
        undefined
      );
      expect(message).toBe('Engine CLI not found. Configure Engine path in Settings.');
    });

    it('mentions Settings in ENGINE_CLI_NOT_FOUND message', () => {
      const message = getCaptureErrorMessage('ENGINE_CLI_NOT_FOUND', undefined, undefined);
      expect(message).toContain('Settings');
    });
  });

  describe('MANIFEST_WRITE_FAILED error code', () => {
    it('uses error message for MANIFEST_WRITE_FAILED', () => {
      const message = getCaptureErrorMessage(
        'MANIFEST_WRITE_FAILED',
        'Capture completed but manifest file was not created',
        'Check disk space and write permissions.'
      );
      expect(message).toBe('Capture completed but manifest file was not created');
    });
  });

  describe('CAPTURE_FAILED error code', () => {
    it('uses error message for generic CAPTURE_FAILED', () => {
      const message = getCaptureErrorMessage(
        'CAPTURE_FAILED',
        'Capture failed due to unknown error',
        undefined
      );
      expect(message).toBe('Capture failed due to unknown error');
    });
  });

  describe('Unknown error codes', () => {
    it('falls back to error message for unknown codes', () => {
      const message = getCaptureErrorMessage(
        'UNKNOWN_ERROR',
        'Something went wrong',
        undefined
      );
      expect(message).toBe('Something went wrong');
    });

    it('falls back to default message when no error info', () => {
      const message = getCaptureErrorMessage(undefined, undefined, undefined);
      expect(message).toBe('Capture failed');
    });
  });

  describe('Error code priority', () => {
    it('ENGINE_CLI_NOT_FOUND takes priority over message', () => {
      // Even if message is provided, ENGINE_CLI_NOT_FOUND should use hint
      const message = getCaptureErrorMessage(
        'ENGINE_CLI_NOT_FOUND',
        'Some other message',
        'Configure Engine path in Settings.'
      );
      expect(message).toBe('Configure Engine path in Settings.');
      expect(message).not.toBe('Some other message');
    });

    it('other codes use message, not hint', () => {
      const message = getCaptureErrorMessage(
        'CAPTURE_FAILED',
        'The actual error message',
        'Some hint that should be ignored'
      );
      expect(message).toBe('The actual error message');
    });
  });
});

/**
 * Capture Draft Content Validation Tests (INV-CAPTURE-1)
 * 
 * Tests for the capture artifact contract: "success implies artifact exists and is valid".
 * GUI must NOT persist draft content if capture failed or content is empty/invalid.
 */
describe('Capture Draft Content Validation (INV-CAPTURE-1)', () => {
  /**
   * Validates draft content before persisting.
   * This mirrors the validation logic in App.tsx handleCaptureFromOverview.
   * 
   * @param draftText - The captured manifest text
   * @returns Error message if invalid, null if valid
   */
  function validateDraftContent(draftText: string | null | undefined): string | null {
    if (!draftText || draftText.trim() === '' || draftText.trim() === '{}') {
      return 'Capture output is empty or invalid. Please try again.';
    }
    return null;
  }

  /**
   * Determines if draft should be persisted based on capture result.
   * 
   * @param success - Whether capture reported success
   * @param draftText - The captured manifest text
   * @returns true if draft should be persisted
   */
  function shouldPersistDraft(success: boolean, draftText: string | null | undefined): boolean {
    if (!success) return false;
    if (validateDraftContent(draftText) !== null) return false;
    return true;
  }

  describe('Empty content validation', () => {
    it('rejects null draft text', () => {
      const error = validateDraftContent(null);
      expect(error).toBe('Capture output is empty or invalid. Please try again.');
    });

    it('rejects undefined draft text', () => {
      const error = validateDraftContent(undefined);
      expect(error).toBe('Capture output is empty or invalid. Please try again.');
    });

    it('rejects empty string', () => {
      const error = validateDraftContent('');
      expect(error).toBe('Capture output is empty or invalid. Please try again.');
    });

    it('rejects whitespace-only string', () => {
      const error = validateDraftContent('   \n\t  ');
      expect(error).toBe('Capture output is empty or invalid. Please try again.');
    });

    it('rejects empty JSON object {}', () => {
      const error = validateDraftContent('{}');
      expect(error).toBe('Capture output is empty or invalid. Please try again.');
    });

    it('rejects empty JSON object with whitespace', () => {
      const error = validateDraftContent('  {}  ');
      expect(error).toBe('Capture output is empty or invalid. Please try again.');
    });
  });

  describe('Valid content acceptance', () => {
    it('accepts valid manifest content', () => {
      const validManifest = '{ "apps": [{ "id": "Microsoft.VSCode" }] }';
      const error = validateDraftContent(validManifest);
      expect(error).toBeNull();
    });

    it('accepts minimal non-empty JSON', () => {
      const minimalJson = '{ "name": "test" }';
      const error = validateDraftContent(minimalJson);
      expect(error).toBeNull();
    });
  });

  describe('Draft persistence decision', () => {
    it('does NOT persist draft when capture failed (success:false)', () => {
      const validContent = '{ "apps": [] }';
      const shouldPersist = shouldPersistDraft(false, validContent);
      expect(shouldPersist).toBe(false);
    });

    it('does NOT persist draft when content is empty {}', () => {
      const shouldPersist = shouldPersistDraft(true, '{}');
      expect(shouldPersist).toBe(false);
    });

    it('does NOT persist draft when content is null', () => {
      const shouldPersist = shouldPersistDraft(true, null);
      expect(shouldPersist).toBe(false);
    });

    it('persists draft when success:true AND content is valid', () => {
      const validContent = '{ "apps": [{ "id": "Microsoft.VSCode" }] }';
      const shouldPersist = shouldPersistDraft(true, validContent);
      expect(shouldPersist).toBe(true);
    });
  });

  describe('Contract: success implies valid artifact', () => {
    it('if success:true but content is {}, this is a contract violation that GUI catches', () => {
      // This scenario represents the bug: engine returns success:true but artifact is empty
      // GUI must detect and reject this
      const engineReportedSuccess = true;
      const emptyArtifact = '{}';
      
      const shouldPersist = shouldPersistDraft(engineReportedSuccess, emptyArtifact);
      expect(shouldPersist).toBe(false);
      
      const error = validateDraftContent(emptyArtifact);
      expect(error).not.toBeNull();
    });
  });
});
