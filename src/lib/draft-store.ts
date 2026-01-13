/**
 * Draft capture storage using localStorage
 * 
 * Draft text is stored in localStorage (NOT as a disk file) to survive app reload/crash.
 * This eliminates the need for draft_*.jsonc temp files.
 */

import { getItem, setItem, removeItem } from './storage';

const DRAFT_TEXT_KEY = 'endstate-capture-draft-text';
const DRAFT_CREATED_AT_KEY = 'endstate-capture-draft-created-at';

export interface CaptureDraft {
  text: string;
  createdAt: string;
  appCount: number;
}

/**
 * Save draft capture text to localStorage
 */
export function saveDraft(draft: CaptureDraft): void {
  try {
    setItem(DRAFT_TEXT_KEY, draft.text);
    setItem(DRAFT_CREATED_AT_KEY, JSON.stringify({
      createdAt: draft.createdAt,
      appCount: draft.appCount,
    }));
  } catch (err) {
    console.error('Failed to save draft to store:', err);
  }
}

/**
 * Load draft capture text from localStorage
 */
export function loadDraft(): CaptureDraft | null {
  try {
    const text = getItem(DRAFT_TEXT_KEY);
    const metaJson = getItem(DRAFT_CREATED_AT_KEY);
    
    if (!text || !metaJson) {
      return null;
    }
    
    const meta = JSON.parse(metaJson);
    return {
      text,
      createdAt: meta.createdAt,
      appCount: meta.appCount,
    };
  } catch (err) {
    console.error('Failed to load draft from store:', err);
    return null;
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(): void {
  try {
    removeItem(DRAFT_TEXT_KEY);
    removeItem(DRAFT_CREATED_AT_KEY);
  } catch (err) {
    console.error('Failed to clear draft from store:', err);
  }
}

/**
 * Check if draft exists in store
 */
export function hasDraft(): boolean {
  return getItem(DRAFT_TEXT_KEY) !== null;
}
