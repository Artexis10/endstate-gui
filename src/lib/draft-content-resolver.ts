/**
 * Draft content resolver for Save Profile flow
 * 
 * Enforces INV-SAVE-1 and INV-SAVE-2 from OpenSpec:
 * - Never invoke write_text_file without non-empty content
 * - Resolve content from in-memory state or draft-store
 */

import { loadDraft } from './draft-store';

export interface PendingCaptureDraft {
  capturedAppsCount: number;
  capturedAt: string;
  draftText: string;
  apps: string[];
}

/**
 * Validate that draft content contains a valid manifest structure.
 * Rejects empty objects and ensures required manifest keys are present.
 */
function isValidManifestContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || trimmed === '' || trimmed === '{}') {
    return false;
  }
  
  // Try to parse and check for manifest structure
  try {
    const parsed = JSON.parse(trimmed);
    // Must be an object with at least 'version' or 'apps' field
    // Empty object {} is not a valid manifest
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }
    // Check for manifest keys (version and apps are required for valid profiles)
    const hasManifestKeys = 'version' in parsed || 'apps' in parsed;
    return hasManifestKeys;
  } catch {
    // If it's not valid JSON, it might be JSONC with comments - allow it
    // The engine writes valid JSONC, so we trust non-parseable content
    return true;
  }
}

/**
 * Resolve draft content for Save Profile operation.
 * 
 * Resolution order (INV-SAVE-2):
 * 1. In-memory pendingCaptureDraft.draftText (non-empty)
 * 2. Await draft-store loadDraft() (non-empty)
 * 3. Otherwise return null
 * 
 * @param pendingDraft - In-memory draft state from React
 * @returns Non-empty draft text or null if unavailable
 */
export async function resolveDraftContent(
  pendingDraft: PendingCaptureDraft | null
): Promise<string | null> {
  // Try in-memory draft first
  if (pendingDraft?.draftText && pendingDraft.draftText.trim() !== '') {
    if (isValidManifestContent(pendingDraft.draftText)) {
      return pendingDraft.draftText;
    }
  }
  
  // Fallback to draft-store
  try {
    const storedDraft = await loadDraft();
    if (storedDraft?.text && storedDraft.text.trim() !== '') {
      if (isValidManifestContent(storedDraft.text)) {
        return storedDraft.text;
      }
    }
  } catch (err) {
    console.error('Failed to load draft from store:', err);
  }
  
  return null;
}
