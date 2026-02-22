/**
 * Types for the Overview Screen components
 */

import type { UiPhase, AppEvent } from '@/lib/apply-utils';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';

export type ActionType = 'capture' | 'setup' | 'check' | null;
export type ActionStatus = 'idle' | 'running' | 'success' | 'error';
export type SetupIntent = 'preview' | 'apply';
export type ActiveFlow = 'none' | 'capture' | 'setup';

export interface ActionProgress {
  message: string;
  detail?: string;
  phase?: UiPhase;  // Current engine phase for UI clarity
}

export interface ActionResult {
  action: ActionType;
  status: 'success' | 'error';
  summary: string;
  details?: string[];
  appEvents?: AppEvent[];
  counts?: {
    installed?: number;
    skipped?: number;
    failed?: number;
    alreadyPresent?: number;
    toInstall?: number;
    missing?: number;
    total?: number;
    manifestTotal?: number; // Total apps in profile manifest (source of truth)
    configsCaptured?: number;
    configsSkipped?: number;
    configsErrored?: number;
  };
  profile?: string;
  timestamp?: string;
  wasPreview?: boolean; // Track if this was a preview (for showing Apply button)
  /** Capture bundle format — 'zip' means config modules may be present */
  outputFormat?: 'jsonc' | 'zip';
  /** Config module IDs successfully captured */
  configsIncluded?: string[];
  /** Config module IDs skipped (no files found) */
  configsSkipped?: string[];
  /** Config module IDs with capture errors */
  configsCaptureErrors?: string[];
}

export interface LiveCounters {
  installed: number;
  alreadyPresent: number;
  skipped: number;
  failed: number;
}

export interface OverviewScreenProps {
  sidebarVisible?: boolean;
  engineConnected?: boolean;
  lifecycleState: LifecycleState;
  selectedProfile: string;
  profiles: DiscoveredProfile[];
  profilesDirectory: string;
  isRunning: boolean;
  runningAction: ActionType;
  actionStatus: ActionStatus;
  actionProgress: ActionProgress | null;
  actionResult: ActionResult | null;
  actionStatusByAction: Record<string, ActionStatus>;
  actionProgressByAction: Record<string, ActionProgress | null>;
  actionResultByAction: Record<string, ActionResult | null>;
  liveAppEvents?: AppEvent[];
  liveCounters?: LiveCounters;
  initialExpandedCard?: ActionType;
  lastSavedProfileSummary?: {
    appCount: number;
    finishedAt: string;
    profileName?: string;
  } | null;
  onNavigate: (page: 'report' | 'settings') => void;
  onCapture: () => void;
  onSetup: (intent: SetupIntent) => void;
  onCheck: () => void;
  onProfileChange: (profile: string, path: string) => void;
  onDismissResult: () => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onRenameProfile?: (path: string, currentName: string) => void;
  onDeleteProfile?: (path: string, displayName: string) => void;
  onSetActiveProfile?: (profile: DiscoveredProfile) => void;
  onClearExpandedCard?: () => void;
  onSaveProfile?: () => void;
  onDiscardDraft?: () => void;
  pendingCaptureDraft?: {
    capturedAppsCount: number;
    capturedAt: string;
    draftText: string;
    apps: string[];
  } | null;
}
