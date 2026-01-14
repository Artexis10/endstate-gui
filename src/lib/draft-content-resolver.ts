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
    return pendingDraft.draftText;
  }
  
  // Fallback to draft-store
  try {
    const storedDraft = await loadDraft();
    if (storedDraft?.text && storedDraft.text.trim() !== '') {
      return storedDraft.text;
    }
  } catch (err) {
    console.error('Failed to load draft from store:', err);
  }
  
  return null;
}
