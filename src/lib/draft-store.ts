/**
 * Draft capture storage using Tauri Store (plugin-store)
 * 
 * Draft text is stored in Tauri Store (NOT as a disk file) to survive app reload/crash.
 * This eliminates the need for draft_*.jsonc temp files.
 * 
 * Tauri Store provides persistent key-value storage that works across app restarts.
 */

import { Store } from '@tauri-apps/plugin-store';

const DRAFT_TEXT_KEY = 'endstate-capture-draft-text';
const DRAFT_CREATED_AT_KEY = 'endstate-capture-draft-created-at';

export interface CaptureDraft {
  text: string;
  createdAt: string;
  appCount: number;
}

/**
 * Get or create the Tauri Store instance.
 * In dev mode (web), falls back to localStorage for testing.
 */
async function getStore(): Promise<Store> {
  // In Tauri runtime, use plugin-store
  if ((window as any).__TAURI__) {
    return await Store.load('endstate-gui.dat');
  }
  
  // Fallback for web dev mode: use localStorage wrapper
  return {
    get: async (key: string) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    set: async (key: string, value: any) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    delete: async (key: string) => {
      localStorage.removeItem(key);
    },
    save: async () => {
      // No-op for localStorage
    },
  } as any;
}

/**
 * Save draft capture text to Tauri Store
 */
export async function saveDraft(draft: CaptureDraft): Promise<void> {
  try {
    const store = await getStore();
    await store.set(DRAFT_TEXT_KEY, draft.text);
    await store.set(DRAFT_CREATED_AT_KEY, {
      createdAt: draft.createdAt,
      appCount: draft.appCount,
    });
    await store.save();
  } catch (err) {
    console.error('Failed to save draft to store:', err);
  }
}

/**
 * Load draft capture text from Tauri Store
 */
export async function loadDraft(): Promise<CaptureDraft | null> {
  try {
    const store = await getStore();
    const text = await store.get<string>(DRAFT_TEXT_KEY);
    const meta = await store.get<{ createdAt: string; appCount: number }>(DRAFT_CREATED_AT_KEY);
    
    if (!text || !meta) {
      return null;
    }
    
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
 * Clear draft from Tauri Store
 */
export async function clearDraft(): Promise<void> {
  try {
    const store = await getStore();
    await store.delete(DRAFT_TEXT_KEY);
    await store.delete(DRAFT_CREATED_AT_KEY);
    await store.save();
  } catch (err) {
    console.error('Failed to clear draft from store:', err);
  }
}

/**
 * Check if draft exists in store
 */
export async function hasDraft(): Promise<boolean> {
  try {
    const store = await getStore();
    const text = await store.get<string>(DRAFT_TEXT_KEY);
    return text !== null && text !== undefined;
  } catch (err) {
    console.error('Failed to check draft in store:', err);
    return false;
  }
}
