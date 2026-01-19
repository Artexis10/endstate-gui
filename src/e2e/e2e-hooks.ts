/**
 * E2E Test Hooks
 * 
 * Exposes window.__endstate_e2e_* hooks for Playwright tests.
 * Only installed when VITE_E2E === "1" (not in DEV mode).
 */

import type { ActionResult } from '@/components/app/overview/types';

interface DiscoveredProfile {
  name: string;
  path: string;
  displayName?: string;
}

interface E2EHookDependencies {
  setPendingCaptureDraft: (draft: {
    capturedAppsCount: number;
    capturedAt: string;
    draftText: string;
    apps: string[];
  }) => void;
  openProfileNameModal: (
    existingName: string,
    suggestedName: string,
    mode: 'save' | 'rename',
    initialValue: string
  ) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setActionResultByAction: React.Dispatch<React.SetStateAction<Record<string, ActionResult | null>>>;
  setActionStatusByAction: React.Dispatch<React.SetStateAction<Record<string, 'idle' | 'running' | 'success' | 'error'>>>;
  setProfiles: React.Dispatch<React.SetStateAction<DiscoveredProfile[]>>;
  setSelectedProfile: React.Dispatch<React.SetStateAction<string>>;
  setSelectedProfilePath: React.Dispatch<React.SetStateAction<string>>;
}

export function installE2EHooks(deps: E2EHookDependencies): () => void {
  const {
    setPendingCaptureDraft,
    openProfileNameModal,
    showToast,
    setActionResultByAction,
    setActionStatusByAction,
    setProfiles,
    setSelectedProfile,
    setSelectedProfilePath,
  } = deps;

  // Hook to open save profile modal with draft
  (window as any).__endstate_e2e_openSaveProfileModal = ({
    draftText,
    suggestedName,
  }: {
    draftText: string;
    suggestedName: string;
  }) => {
    setPendingCaptureDraft({
      capturedAppsCount: 0,
      capturedAt: new Date().toISOString(),
      draftText: draftText || '{}',
      apps: [],
    });
    openProfileNameModal('', suggestedName, 'save', suggestedName);
  };

  // Hook to show toast messages
  (window as any).__endstate_e2e_showToast = showToast;

  // Hook to inject capture result for testing ActionDetailsModal
  (window as any).__endstate_e2e_setCaptureResult = (result: ActionResult) => {
    setActionResultByAction(prev => ({ ...prev, capture: result }));
    setActionStatusByAction(prev => ({ ...prev, capture: result.status }));
  };

  // Hook to seed profiles state directly (bypasses profile discovery)
  (window as any).__endstate_e2e_seedProfiles = ({
    profiles,
    selectedProfile,
    selectedProfilePath,
  }: {
    profiles: DiscoveredProfile[];
    selectedProfile: string;
    selectedProfilePath: string;
  }) => {
    setProfiles(profiles);
    setSelectedProfile(selectedProfile);
    setSelectedProfilePath(selectedProfilePath);
  };

  // Return cleanup function
  return () => {
    delete (window as any).__endstate_e2e_openSaveProfileModal;
    delete (window as any).__endstate_e2e_showToast;
    delete (window as any).__endstate_e2e_setCaptureResult;
    delete (window as any).__endstate_e2e_seedProfiles;
  };
}
