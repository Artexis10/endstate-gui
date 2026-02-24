import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  EndstateEnvelope,
  EndstateCapabilitiesData,
  EndstateVerifyData,
  EndstateReportData,
  EndstateApplyData,
  EndstateCaptureData,
  EndstateApplyResultData,
  type RestoreItem,
  type RestoreSummary,
} from './types';
import { AppSettings, loadSettings, saveSettings, loadSettingsWithProfileMigration, clearSelectedProfile } from './settings';
import { saveDraft, loadDraft, clearDraft } from './lib/draft-store';
import { resolveDraftContent } from './lib/draft-content-resolver';
import { resolveProfilePath } from './lib/profile-selection-migration';
import { discoverProfiles, DiscoveredProfile } from './file-discovery';
import { StreamEvent } from './streaming-runner';
import { runEngineStreaming } from './lib/engine';
import { LogBuffer } from './log-buffer';
import { StreamingLineBuffer, reconcileLiveActivity, itemEventToAppEvent, getPhaseAwareStatusForEvent, type AppEvent, type UiPhase } from './lib/apply-utils';
import { isItemEvent, isArtifactEvent, isPhaseEvent, isRestoreItemEvent, type EnginePhase } from './lib/streaming-events';
import { loadLastRunForCommand, migrateLegacyLastRun, type LastRunData } from './lib/last-run';
import { loadLifecycleState, recordLifecycleEvent, formatRelativeTime, type LifecycleState, type LifecycleEvent } from './lib/lifecycle-state';
import { loadSidebarVisible, saveSidebarVisible } from './lib/ui-mode';
import { OverviewScreen } from './components/app/overview-screen';
import { IntentLanding, SaveFlow, SetupFlow } from './components/app/intent';
import { getProfilesDirectory, ensureDirectory, isTauriRuntime, openFolder, invoke } from './lib/tauri-bridge';
import { runEndstateOnce, getErrorMessage, buildEngineCommand } from './lib/engine-exec';
import { saveProfileMetadata, deleteProfileFiles } from './lib/profile-metadata';
import { validateProfileFilename, getExtension, type ValidExtension } from './lib/filename-validation';
import { loadRunSummaries, createRunBundle, generateRunId, writeSummary, writeLog, generateDiagnosticsText, writeDiagnostics, type RunBundle, type RunSummary } from './lib/run-artifacts';
import { buildCaptureActionResult, getCapturedConfigCount, deriveCaptureSummaryText } from './lib/capture-continuity';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/layout/command-palette';
import { PageHeader } from './components/app/page-header';
import { RenameFileModal } from './components/app/rename-file-modal';
import { LogViewerModal } from './components/app/log-viewer-modal';
import { ToastProvider, useToast } from './components/ui/toast';
import { formatCount } from './lib/pluralize';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { Loader2, Copy, ChevronDown, ChevronRight, ChevronUp, FolderOpen, FileText, CheckCircle2 } from 'lucide-react';
import { useMicroFeedback } from './lib/micro-feedback';
import { InlineFeedbackPopover } from './components/ui/inline-feedback-popover';
import { copyText } from './lib/clipboard';

type AppStatus = 'loading' | 'ready' | 'error';
type PageType = 'landing' | 'save' | 'setup' | 'overview' | 'report' | 'settings';

interface AppState {
  status: AppStatus;
  errorMessage: string | null;
  errorStderr: string | null;
  errorCommand: string | null;
  capabilities: EndstateEnvelope<EndstateCapabilitiesData> | null;
  report: EndstateEnvelope<EndstateReportData> | null;
  verify: EndstateEnvelope<EndstateVerifyData> | null;
}

function AppContent() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [previousPage, setPreviousPage] = useState<PageType | null>(null);
  // Track which Overview card to auto-expand
  const [overviewExpandedCard, setOverviewExpandedCard] = useState<'capture' | 'setup' | 'check' | null>(null);
  
  // Navigation handler
  const handleNavigate = async (page: PageType) => {
    setOverviewExpandedCard(null);
    setCurrentPage(page);
    
    // Load run artifacts when navigating to Report page
    if (page === 'report' && profilesDirectory) {
      const artifacts = await loadRunSummaries(profilesDirectory);
      setRunArtifacts(artifacts);
    }
  };
  const [sidebarVisible, setSidebarVisible] = useState(loadSidebarVisible());
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [profiles, setProfiles] = useState<DiscoveredProfile[]>([]);
  const [profilesDirectory, setProfilesDirectory] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');
  const [selectedProfilePath, setSelectedProfilePath] = useState('');
  
  const [state, setState] = useState<AppState>({
    status: 'loading',
    errorMessage: null,
    errorStderr: null,
    errorCommand: null,
    capabilities: null,
    report: null,
    verify: null,
  });

  const [isRunning, setIsRunning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_runLogs, setRunLogs] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_logTruncated, setLogTruncated] = useState(false);
  // Per-command last run state
  const [lastRunCapture, setLastRunCapture] = useState<LastRunData | null>(null);
  const [lastRunApply, setLastRunApply] = useState<LastRunData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lastRunVerify, setLastRunVerify] = useState<LastRunData | null>(null);
  const [safeMode, setSafeMode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const logBufferRef = useRef<LogBuffer | null>(null);
  const applyLineBufferRef = useRef<StreamingLineBuffer | null>(null);
  
  // Global lifecycle state - tracks last capture, preview, apply, verify
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>(loadLifecycleState());
  
  // Overview action state - tracks which action is running and its status
  type OverviewActionType = 'capture' | 'setup' | 'check' | null;
  type OverviewActionStatus = 'idle' | 'running' | 'success' | 'error';
  
  // Per-app event for detailed tracking - uses AppEvent from apply-utils
  
  // Enhanced action result with app events
  interface OverviewActionResult {
    action: OverviewActionType;
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
      configsRestored?: number;
    };
    profile?: string;
    timestamp?: string;
    wasPreview?: boolean; // Track if this was a preview (for showing Apply button)
    restoreItems?: RestoreItem[];
    restoreSummary?: RestoreSummary;
    restoreJournalFile?: string;
    restoreModulesAvailable?: string[];
  }
  
  // Live counters during apply/preview
  // Option A: Truthful model with friendly grouping
  // - installed: count of Installed
  // - alreadyPresent: count of OK (verified present)
  // - skipped: count of Skipped (non-OK skips)
  // - failed: count of Failed
  interface LiveCounters {
    installed: number;
    alreadyPresent: number;
    skipped: number;
    failed: number;
    configsRestored?: number;
    configsSkipped?: number;
    configsFailed?: number;
  }
  
  const [overviewRunningAction, setOverviewRunningAction] = useState<OverviewActionType>(null);
  // Per-action state to prevent leakage between actions
  const [actionStatusByAction, setActionStatusByAction] = useState<Record<string, OverviewActionStatus>>({
    capture: 'idle',
    setup: 'idle',
    check: 'idle',
  });
  const [actionProgressByAction, setActionProgressByAction] = useState<Record<string, { message: string; detail?: string; phase?: UiPhase } | null>>({
    capture: null,
    setup: null,
    check: null,
  });
  const [actionResultByAction, setActionResultByAction] = useState<Record<string, OverviewActionResult | null>>({
    capture: null,
    setup: null,
    check: null,
  });
  // Computed values for current running action (for backward compatibility)
  const overviewActionStatus = overviewRunningAction ? actionStatusByAction[overviewRunningAction] : 'idle';
  const overviewActionProgress = overviewRunningAction ? actionProgressByAction[overviewRunningAction] : null;
  const overviewActionResult = overviewRunningAction ? actionResultByAction[overviewRunningAction] : null;
  const [liveAppEvents, setLiveAppEvents] = useState<AppEvent[]>([]);
  const [liveCounters, setLiveCounters] = useState<LiveCounters>({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });

  // Throttled streaming updates: during engine runs, events arrive faster than
  // useful re-render rate. Buffer all streaming state and flush at ~5/sec.
  const pendingEventsRef = useRef<AppEvent[] | null>(null);
  const pendingCountersRef = useRef<LiveCounters | null>(null);
  const pendingProgressRef = useRef<{ action: string; progress: { message: string; detail?: string; phase?: import('./lib/apply-utils').UiPhase } } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function doFlush() {
    if (pendingEventsRef.current !== null) {
      setLiveAppEvents(pendingEventsRef.current);
      pendingEventsRef.current = null;
    }
    if (pendingCountersRef.current !== null) {
      setLiveCounters(pendingCountersRef.current);
      pendingCountersRef.current = null;
    }
    if (pendingProgressRef.current !== null) {
      const { action, progress } = pendingProgressRef.current;
      setActionProgressByAction(prev => ({ ...prev, [action]: progress }));
      pendingProgressRef.current = null;
    }
  }

  /**
   * Queue streaming state updates. Flushes at most once every 200ms.
   * Call flushLiveUpdates() for immediate final flush (e.g., on completion).
   */
  function throttledSetLiveAppEvents(events: AppEvent[], counters?: LiveCounters) {
    pendingEventsRef.current = events;
    if (counters !== undefined) pendingCountersRef.current = counters;
    if (flushTimerRef.current === null) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        doFlush();
      }, 200);
    }
  }

  /** Queue a progress update (batched with event/counter updates). */
  function throttledSetProgress(action: string, progress: { message: string; detail?: string; phase?: import('./lib/apply-utils').UiPhase }) {
    pendingProgressRef.current = { action, progress };
    if (flushTimerRef.current === null) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        doFlush();
      }, 200);
    }
  }

  /** Immediately flush any pending streaming updates. */
  function flushLiveUpdates() {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    doFlush();
  }

  const isRunningRef = useRef(false); // Robust guard against double-run
  const activeRunIdRef = useRef<string | null>(null); // Track active run ID for double-run prevention
  const [activeRunId, setActiveRunId] = useState<string | null>(null); // App-level active run ID for UI awareness
  const [showFolderPathModal, setShowFolderPathModal] = useState(false);
  const [folderPathForModal, setFolderPathForModal] = useState('');
  
  // Pending capture draft state - in-memory + localStorage (no disk file)
  const [pendingCaptureDraft, setPendingCaptureDraft] = useState<{
    capturedAppsCount: number;
    capturedAt: string;
    draftText: string;
    apps: string[];
  } | null>(null);
  
  // Saved profile summary - drives green success strip
  // Set ONLY after successful Save Profile (not after capture, not after discard)
  const [lastSavedProfileSummary, setLastSavedProfileSummary] = useState<{
    appCount: number;
    finishedAt: string;
    profileName?: string;
  } | null>(null);
  
  // Save in progress flag to prevent double-submit
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Profile naming modal state
  const [showProfileNameModal, setShowProfileNameModal] = useState(false);
  const [profileNameModalPath, setProfileNameModalPath] = useState(''); // Path for rename mode only (not used for draft)
  const [profileNameModalValue, setProfileNameModalValue] = useState(''); // User-typed display name
  const [profileNameModalMode, setProfileNameModalMode] = useState<'save' | 'rename'>('save');
  const [profileNameModalMoreOptions, setProfileNameModalMoreOptions] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_pendingSuggestedName, setPendingSuggestedName] = useState(''); // Suggested filename for new profile (reserved for future use)
  const [profileNameModalSuccess, setProfileNameModalSuccess] = useState(false); // Transitory success state
  const [savedProfileDisplayName, setSavedProfileDisplayName] = useState(''); // Store name for success animation
  
  // Profile delete confirmation modal state
  const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);
  const [deleteProfilePath, setDeleteProfilePath] = useState('');
  const [deleteProfileName, setDeleteProfileName] = useState('');
  
  // Profile file rename modal state
  const [showRenameFileModal, setShowRenameFileModal] = useState(false);
  const [renameFilePath, setRenameFilePath] = useState('');
  const [renameFileCurrentName, setRenameFileCurrentName] = useState('');
  
  // Run artifacts state for Report page
  const [runArtifacts, setRunArtifacts] = useState<Array<{ bundle: RunBundle; summary: RunSummary }>>([]);
  
  // Log viewer modal state
  const [showLogViewerModal, setShowLogViewerModal] = useState(false);
  const [logViewerContent, setLogViewerContent] = useState('');
  const [logViewerTitle, setLogViewerTitle] = useState('Log Viewer');
  const [logViewerLoading, setLogViewerLoading] = useState(false);
  const [logViewerError, setLogViewerError] = useState<string | null>(null);
  
  // Helper to open log viewer modal
  const openLogViewer = async (logPath: string, title: string = 'Log Viewer') => {
    setLogViewerTitle(title);
    setLogViewerContent('');
    setLogViewerError(null);
    setLogViewerLoading(true);
    setShowLogViewerModal(true);
    
    try {
      const content = await invoke<string>('read_text_file', { path: logPath });
      setLogViewerContent(content);
    } catch (err) {
      console.error('Failed to read log file:', err);
      setLogViewerError('Failed to read log file');
    } finally {
      setLogViewerLoading(false);
    }
  };
  
  // Micro-feedback hooks for copy actions
  const diagnosticsCopyFeedback = useMicroFeedback();
  const folderPathCopyFeedback = useMicroFeedback();
  const artifactPathCopyFeedback = useMicroFeedback();
  const artifactDiagnosticsCopyFeedback = useMicroFeedback();
  
  // Helper functions to update per-action state
  // CRITICAL: Accept action parameter to avoid stale closure over overviewRunningAction
  const setOverviewActionStatus = (action: NonNullable<OverviewActionType>, status: OverviewActionStatus) => {
    setActionStatusByAction(prev => ({ ...prev, [action]: status }));
  };
  
  const setOverviewActionProgress = (action: NonNullable<OverviewActionType>, progress: { message: string; detail?: string; phase?: UiPhase } | null) => {
    setActionProgressByAction(prev => ({ ...prev, [action]: progress }));
  };
  
  const setOverviewActionResult = (action: NonNullable<OverviewActionType>, result: OverviewActionResult | null) => {
    setActionResultByAction(prev => ({ ...prev, [action]: result }));
  };
  
  // Dismiss result - clear transient result state for a specific action
  const dismissOverviewResult = (action?: 'capture' | 'setup' | 'check') => {
    const actionToDismiss = action || overviewRunningAction;
    if (!actionToDismiss) return;
    
    // Clear only the specific action's state
    setActionProgressByAction(prev => ({ ...prev, [actionToDismiss]: null }));
    setActionResultByAction(prev => ({ ...prev, [actionToDismiss]: null }));
    setActionStatusByAction(prev => ({ ...prev, [actionToDismiss]: 'idle' }));
    
    // Clear live events/counters only if dismissing the currently running action
    if (actionToDismiss === overviewRunningAction) {
      setLiveAppEvents([]);
      setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0, configsRestored: 0, configsSkipped: 0, configsFailed: 0 });
    }
    
    // Also clear lastSavedProfileSummary for capture card dismissal
    if (actionToDismiss === 'capture') {
      setLastSavedProfileSummary(null);
    }
  };
  
  // Navigation with back support - tracks previous page when navigating from Overview
  const navigateWithHistory = (page: PageType) => {
    if (currentPage === 'overview' && page !== 'overview') {
      setPreviousPage('overview');
      // DON'T reset overview action state - preserve it for return navigation
      // User should be able to return to Overview and see last run results
    }
    setCurrentPage(page);
  };
  
  // Go back to previous page
  const handleBack = () => {
    if (previousPage) {
      setCurrentPage(previousPage);
      setPreviousPage(null);
    }
  };
  
  // Handle sidebar toggle with persistence
  const handleToggleSidebar = () => {
    const newVisible = !sidebarVisible;
    setSidebarVisible(newVisible);
    saveSidebarVisible(newVisible);
  };
  

  const loadProfilesDirectory = async () => {
    try {
      const dir = await getProfilesDirectory(settings.customProfilesDirectory);
      return dir;
    } catch (err) {
      console.error('Failed to load profiles directory:', err);
      return null;
    }
  };

  const refreshProfiles = async () => {
    const dir = await loadProfilesDirectory();
    if (dir) {
      setProfilesDirectory(dir);
      const discovered = await discoverProfiles(dir);
      setProfiles(discovered);
    }
  };

  const handleOpenProfilesFolder = async () => {
    if (profilesDirectory) {
      try {
        const result = await openFolder(profilesDirectory);
        if (!result.ok && result.reason === 'web' && result.path) {
          // Web mode: show modal with path
          setFolderPathForModal(result.path);
          setShowFolderPathModal(true);
        }
        // If ok: true, folder opened successfully in Tauri (no action needed)
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  const openProfileNameModal = (profilePath: string, existingName: string = '', mode: 'save' | 'rename' = 'save', suggestedName: string = '') => {
    // For save mode, profilePath is ignored (draft comes from store)
    // For rename mode, profilePath is the profile file to rename
    if (mode === 'rename') {
      setProfileNameModalPath(profilePath);
    }
    setProfileNameModalValue(existingName);
    setProfileNameModalMode(mode);
    setProfileNameModalMoreOptions(false);
    setPendingSuggestedName(suggestedName);
    setShowProfileNameModal(true);
  };

  // E2E test hooks - installed when VITE_E2E === "1" OR runtime flag is set
  // Runtime flag allows tests to enable hooks even when reusing an existing dev server
  useEffect(() => {
    const isE2E = import.meta.env.VITE_E2E === '1' || (window as any).__ENDSTATE_E2E_MODE__;
    if (isE2E) {
      let cleanup: (() => void) | undefined;
      
      import('./e2e/e2e-hooks').then(({ installE2EHooks }) => {
        cleanup = installE2EHooks({
          setPendingCaptureDraft,
          openProfileNameModal,
          showToast,
          setActionResultByAction,
          setActionStatusByAction,
          setProfiles,
          setSelectedProfile,
          setSelectedProfilePath,
        });
      });
      
      return () => {
        cleanup?.();
      };
    }
  }, []);

  const handleSaveProfileName = async () => {
    if (isSavingProfile) return; // Prevent double-submit
    setIsSavingProfile(true);
    
    try {
      const trimmedValue = profileNameModalValue.trim();
      
      if (profileNameModalMode === 'save') {
        // Save mode: write draft text to profiles directory
        // INV-SAVE-2: Resolve and validate draft content before proceeding
        const draftContent = await resolveDraftContent(pendingCaptureDraft);
        if (!draftContent) {
          showToast('No capture draft available. Please run Capture again.', 'error');
          setShowProfileNameModal(false);
          setProfileNameModalPath('');
          setProfileNameModalValue('');
          setProfileNameModalMoreOptions(false);
          setPendingSuggestedName('');
          return;
        }
        
        // Get profiles directory as destination
        const profilesDir = await loadProfilesDirectory();
        if (!profilesDir) {
          throw new Error('Failed to determine profiles directory');
        }
        await ensureDirectory(profilesDir);
        
        const extension = '.jsonc';
        let newFilename: string;
        let destPath: string;
        
        if (trimmedValue) {
          // Sanitize the name for use as filename
          const sanitized = trimmedValue
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .slice(0, 100); // Limit length
          
          // Generate new filename with collision avoidance
          newFilename = `${sanitized}${extension}`;
          destPath = `${profilesDir}\\${newFilename}`;
          
          // Check for collision and add suffix if needed
          let suffix = 1;
          while (true) {
            const exists = await invoke<boolean>('check_file_exists', { path: destPath });
            if (!exists) break;
            newFilename = `${sanitized}_${suffix}${extension}`;
            destPath = `${profilesDir}\\${newFilename}`;
            suffix++;
            if (suffix > 100) break; // Safety limit
          }
        } else {
          // No name provided, use timestamp-based name
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
          newFilename = `setup_${timestamp}${extension}`;
          destPath = `${profilesDir}\\${newFilename}`;
        }
        
        // INV-SAVE-MANIFEST: Write manifest JSONC to .jsonc file
        // draftContent contains the captured manifest (apps, version, etc.), NOT metadata
        await invoke('write_text_file', { path: destPath, content: draftContent });
        
        // INV-SAVE-META: Write metadata to separate .meta.json file
        // Metadata (displayName) is stored separately from the manifest
        if (trimmedValue) {
          await saveProfileMetadata(destPath, { displayName: trimmedValue });
        }
      } else {
        // Rename mode: just update display name metadata
        await saveProfileMetadata(profileNameModalPath, { 
          displayName: trimmedValue || undefined 
        });
      }
      
      // INV-SAVE-REFRESH: Post-save state updates
      // 1. Refresh profiles list from disk
      await refreshProfiles();
      
      // Track the saved profile for success animation
      let savedProfileForAnimation: DiscoveredProfile | null = null;
      
      // If this was a save from capture draft, complete post-save flow
      if (profileNameModalMode === 'save' && pendingCaptureDraft) {
        // 2. Select the newly saved profile
        const dir = await loadProfilesDirectory();
        if (dir) {
          const discovered = await discoverProfiles(dir);
          // Find the profile that matches the saved name
          const savedProfile = discovered.find(p => 
            (trimmedValue && p.displayName === trimmedValue)
          ) || discovered.sort((a, b) => b.path.localeCompare(a.path))[0];
          
          if (savedProfile) {
            savedProfileForAnimation = savedProfile;
            setSelectedProfile(savedProfile.name);
            setSelectedProfilePath(savedProfile.path);
            updateSettings({ selectedProfileName: savedProfile.name });
          }
        }
        // 3. Clear draft from store and memory
        await clearDraft();
        setPendingCaptureDraft(null);
        
        // Set lastSavedProfileSummary to show green success after profile is saved
        // This is the ONLY place green success should be set for Capture
        const captureResult = actionResultByAction['capture'];
        if (captureResult?.action === 'capture' && captureResult.counts?.total !== undefined) {
          setLastSavedProfileSummary({
            appCount: captureResult.counts.total,
            finishedAt: new Date().toISOString(),
            profileName: savedProfileForAnimation?.displayName || savedProfileForAnimation?.name || trimmedValue,
          });
        }
      }
      
      // Show transitory success state in modal
      // Use the saved profile we just found, or fall back to the trimmed value
      let displayName = trimmedValue || 'Profile';
      if (savedProfileForAnimation) {
        displayName = savedProfileForAnimation.displayName || savedProfileForAnimation.name;
      }
      setSavedProfileDisplayName(displayName);
      setProfileNameModalSuccess(true);
      
      // 4. Close modal after success animation (INV-SAVE-REFRESH)
      // Auto-close after 1500ms to show success state
      setTimeout(() => {
        setShowProfileNameModal(false);
        setProfileNameModalPath('');
        setProfileNameModalValue('');
        setProfileNameModalMoreOptions(false);
        setPendingSuggestedName('');
        setProfileNameModalSuccess(false);
        setSavedProfileDisplayName('');
      }, 1500);
    } catch (err) {
      console.error('Failed to save profile name:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Handle draft missing error
      if (errorMessage.includes('Draft capture missing')) {
        if (profileNameModalMode === 'save' && pendingCaptureDraft) {
          await clearDraft();
          setPendingCaptureDraft(null);
        }
        setShowProfileNameModal(false);
        setProfileNameModalPath('');
        setProfileNameModalValue('');
        setProfileNameModalMoreOptions(false);
        setPendingSuggestedName('');
        setProfileNameModalSuccess(false);
        setSavedProfileDisplayName('');
        showToast('Draft capture missing — please run Capture again.', 'error');
      } else if (errorMessage.includes('Source file no longer exists') || errorMessage.includes('does not exist')) {
        // Profile file missing (rename mode)
        setShowProfileNameModal(false);
        setProfileNameModalPath('');
        setProfileNameModalValue('');
        setProfileNameModalMoreOptions(false);
        setPendingSuggestedName('');
        setProfileNameModalSuccess(false);
        setSavedProfileDisplayName('');
        if (profileNameModalMode === 'rename') {
          showToast('Previously selected profile not found — please select a profile.', 'error');
        } else {
          showToast('Profile file not found — please select a profile.', 'error');
        }
      } else {
        showToast(`Failed to save profile: ${errorMessage}`, 'error');
        // Do NOT close modal or clear pendingCaptureDraft on other errors - user can retry
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelProfileName = async () => {
    // Contract A: Cancel/close does NOT clear pendingCaptureDraft.
    // The draft persists in memory until the user explicitly chooses Save profile OR Discard draft.
    // This allows users to close the modal and return later to save.
    
    // Close modal and reset modal-specific state only
    setShowProfileNameModal(false);
    setProfileNameModalPath('');
    setProfileNameModalValue('');
    setProfileNameModalMoreOptions(false);
    setPendingSuggestedName('');
  };

  const handleDiscardDraft = async () => {
    if (!pendingCaptureDraft) return;
    
    // Clear draft from Tauri Store
    await clearDraft();
    
    // Clear in-memory draft state
    setPendingCaptureDraft(null);
    
    // Clear capture action state - return to idle
    setOverviewActionResult('capture', null);
    setOverviewActionStatus('capture', 'idle');
    setOverviewActionProgress('capture', null);
  };

  const handleDeleteProfile = async () => {
    if (!deleteProfilePath) return;
    
    // Safety check: prevent deleting the currently selected profile
    if (deleteProfilePath === selectedProfilePath) {
      console.error('Cannot delete the currently selected profile');
      setShowDeleteProfileModal(false);
      setDeleteProfilePath('');
      setDeleteProfileName('');
      return;
    }
    
    try {
      // Delete both setup and metadata files
      await deleteProfileFiles(deleteProfilePath);
      
      // Refresh profiles to get updated list
      const dir = await loadProfilesDirectory();
      if (dir) {
        setProfilesDirectory(dir);
        const discovered = await discoverProfiles(dir);
        setProfiles(discovered);
        
        // Selection fallback: if selected profile was deleted (shouldn't happen due to check above)
        // or if it disappeared for another reason, select first available or null
        const selectedStillExists = discovered.some(p => p.path === selectedProfilePath);
        if (!selectedStillExists) {
          if (discovered.length > 0) {
            // Auto-select first profile
            const firstProfile = discovered[0];
            setSelectedProfile(firstProfile.name);
            setSelectedProfilePath(firstProfile.path);
            updateSettings({ selectedProfileName: firstProfile.name });
            // Show toast notification for fallback selection
            showToast(`Selected profile no longer exists—switched to "${firstProfile.displayName || firstProfile.name}".`, 'info');
          } else {
            // No profiles remain
            setSelectedProfile('');
            setSelectedProfilePath('');
            updateSettings({ selectedProfileName: null });
            showToast('No profiles available. Create a profile by capturing your computer setup.', 'info');
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
    setShowDeleteProfileModal(false);
    setDeleteProfilePath('');
    setDeleteProfileName('');
  };

  const handleSetActiveProfile = (profile: DiscoveredProfile) => {
    setSelectedProfile(profile.name);
    setSelectedProfilePath(profile.path);
    updateSettings({ selectedProfileName: profile.name });
    showToast(`"${profile.displayName || profile.name}" is now the active profile`, 'success');
  };

  const openRenameFileModal = (path: string, currentFilename: string) => {
    setRenameFilePath(path);
    setRenameFileCurrentName(currentFilename);
    setShowRenameFileModal(true);
  };

  const handleRenameFile = async (newFilename: string) => {
    if (!renameFilePath || !newFilename) return;
    
    // Non-bypassable Zod validation guard
    const originalExtension: ValidExtension = getExtension(renameFileCurrentName);
    const validation = validateProfileFilename(newFilename, originalExtension);
    if (!validation.success) {
      showToast(validation.error, 'error');
      return;
    }
    
    try {
      // Dynamically import to avoid circular dependency
      const { getMetaPath } = await import('./file-discovery');
      
      // Get directory and construct new path
      const pathParts = renameFilePath.split(/[\\]/);
      const directory = pathParts.slice(0, -1).join('\\');
      const newPath = `${directory}\\${newFilename}`;
      
      // Check if target file already exists
      const exists = await invoke<boolean>('check_file_exists', { path: newPath });
      if (exists) {
        showToast('A file with this name already exists', 'error');
        return;
      }
      
      // Rename the manifest file
      await invoke('rename_file', { oldPath: renameFilePath, newPath });
      
      // Rename the metadata file if it exists
      const oldMetaPath = getMetaPath(renameFilePath);
      const newMetaPath = getMetaPath(newPath);
      const metaExists = await invoke<boolean>('check_file_exists', { path: oldMetaPath });
      if (metaExists) {
        await invoke('rename_file', { oldPath: oldMetaPath, newPath: newMetaPath });
      }
      
      // Update selected profile if it was the renamed one
      if (renameFilePath === selectedProfilePath) {
        const newName = newFilename.replace(/\.(jsonc?|json5)$/i, '');
        setSelectedProfile(newName);
        setSelectedProfilePath(newPath);
        updateSettings({ selectedProfileName: newName });
      }
      
      await refreshProfiles();
      showToast('File renamed successfully', 'success');
    } catch (err) {
      console.error('Failed to rename file:', err);
      showToast(`Failed to rename file: ${err}`, 'error');
    }
    
    setShowRenameFileModal(false);
    setRenameFilePath('');
    setRenameFileCurrentName('');
  };

  const promptForProfileName = async (_profilePath: string) => {
    // Generate a default name based on timestamp
    const now = new Date();
    const defaultName = `Profile ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    openProfileNameModal('', defaultName, 'save');
  };

  useEffect(() => {
    const initializeApp = async () => {
      // Load profiles directory first
      const dir = await loadProfilesDirectory();
      if (dir) {
        setProfilesDirectory(dir);
        
        // Load settings with profile selection migration
        const migratedSettings = await loadSettingsWithProfileMigration(dir);
        setSettings(migratedSettings);
        
        // Resolve selected profile name to path
        if (migratedSettings.selectedProfileName) {
          const resolvedPath = await resolveProfilePath(migratedSettings.selectedProfileName, dir);
          if (resolvedPath) {
            setSelectedProfile(migratedSettings.selectedProfileName);
            setSelectedProfilePath(resolvedPath);
          } else {
            // Profile name exists in settings but file not found - clear selection
            console.warn('[init] Selected profile not found, clearing selection:', migratedSettings.selectedProfileName);
            clearSelectedProfile();
            setSelectedProfile('');
            setSelectedProfilePath('');
            showToast('Previously selected profile not found. Please select a profile.', 'info');
          }
        } else {
          // No profile selected
          setSelectedProfile('');
          setSelectedProfilePath('');
        }
        
        // Refresh profiles list
        const discovered = await discoverProfiles(dir);
        setProfiles(discovered);
      }
      
      // Migrate legacy last run and load per-command last runs
      migrateLegacyLastRun();
      setLastRunCapture(loadLastRunForCommand('capture'));
      setLastRunApply(loadLastRunForCommand('apply'));
      setLastRunVerify(loadLastRunForCommand('verify'));
      
      // Clean up any leftover transient capture files from previous sessions
      invoke('cleanup_capture_cache').catch(() => {
        // Ignore cleanup errors - best effort only
      });
      
      // Load draft from store if exists (survives reload)
      const storedDraft = await loadDraft();
      if (storedDraft) {
        setPendingCaptureDraft({
          capturedAppsCount: storedDraft.appCount,
          capturedAt: storedDraft.createdAt,
          draftText: storedDraft.text,
          apps: [],
        });
      }
    };
    
    initializeApp();
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [settings.customProfilesDirectory]);


  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  const resetSettings = () => {
    localStorage.removeItem('endstate-gui-settings');
    const defaults = loadSettings();
    setSettings(defaults);
    setSelectedProfile('');
    setSelectedProfilePath('');
    setProfiles([]);
    refreshProfiles();
    loadInitialData();
  };

  const loadInitialData = async () => {
    setState({
      status: 'loading',
      errorMessage: null,
      errorStderr: null,
      errorCommand: null,
      capabilities: null,
      report: null,
      verify: null,
    });

    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });

    try {
      // Use non-streaming exec for capabilities (one-shot command)
      const capResult = await runEndstateOnce<EndstateEnvelope<EndstateCapabilitiesData>>(
        settings,
        'capabilities',
        []
      );

      if (!capResult.success) {
        setState({
          status: 'error',
          errorMessage: getErrorMessage(capResult.error),
          errorStderr: capResult.stderr || null,
          errorCommand: capResult.error.command || 'endstate capabilities --json',
          capabilities: null,
          report: null,
          verify: null,
        });
        return;
      }

      // Capabilities succeeded - continue with report (also non-streaming)
      const reportResult = await runEndstateOnce<EndstateEnvelope<EndstateReportData>>(
        settings,
        'report',
        []
      );

      let verifyResult: EndstateEnvelope<EndstateVerifyData> | null = null;
      if (selectedProfile && profiles.length > 0) {
        const result = await runEndstateOnce<EndstateEnvelope<EndstateVerifyData>>(
          settings,
          'verify',
          ['--profile', selectedProfile]
        );
        if (result.success) {
          verifyResult = result.envelope;
        } else if (result.envelope && result.envelope.error?.code === 'VERIFY_FAILED') {
          // Domain failure (missing apps) - still use the envelope data
          // This is NOT a runtime error, just verification found issues
          verifyResult = result.envelope;
        }
      }

      // Success - clear any previous error state
      setState({
        status: 'ready',
        errorMessage: null,
        errorStderr: null,
        errorCommand: null,
        capabilities: capResult.envelope,
        report: reportResult.success ? reportResult.envelope : null,
        verify: verifyResult,
      });
    } catch (err) {
      // Catch any unexpected errors (timeouts, network issues, etc.)
      const fallbackCmd = buildEngineCommand(settings, ['capabilities', '--json']);
      setState({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to initialize engine',
        errorStderr: null,
        errorCommand: fallbackCmd.displayCommand,
        capabilities: null,
        report: null,
        verify: null,
      });
    }
  };

  useEffect(() => {
    if (settings.engineMode && (settings.engineMode === 'bundled' || settings.engineMode === 'path' || settings.engineScriptPath)) {
      loadInitialData();
    }
  }, [settings.engineMode, settings.engineScriptPath]);

  // Overview-specific handlers that execute in-place without navigation or modals
  const handleCaptureFromOverview = async () => {
    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });

    // Use temp directory for engine output (will be read and discarded)
    const tempDir = await invoke<string>('get_capture_cache_directory');
    if (!tempDir) {
      throw new Error('Failed to determine temp directory');
    }
    
    await ensureDirectory(tempDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const filename = `capture_${timestamp}.jsonc`;
    const outputPath = `${tempDir}\\${filename}`;

    // Get profiles directory for run artifacts (separate from cache)
    const profilesDir = await loadProfilesDirectory();

    // Create run artifact bundle
    const runId = generateRunId();
    const runBundle = profilesDir ? await createRunBundle(profilesDir, runId) : null;
    const runStartTime = Date.now();

    // Track capture live activity via NDJSON events
    const overviewCaptureEvents: AppEvent[] = [];
    let overviewCapturePhase: EnginePhase = 'capture';
    
    const captureResult = await runEngineStreaming(
      settings,
      'capture',
      ['--out', outputPath],
      (event: StreamEvent) => {
        // Collect raw output for Technical Details only
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
        }
      },
      {
        enableNdjsonEvents: true,
        onNdjsonEvent: (ndjsonEvent: import('./lib/streaming-events').StreamingEvent) => {
          if (isPhaseEvent(ndjsonEvent)) {
            overviewCapturePhase = ndjsonEvent.phase;
          } else if (isItemEvent(ndjsonEvent)) {
            const appEvent = itemEventToAppEvent(ndjsonEvent, overviewCapturePhase);
            overviewCaptureEvents.push(appEvent);
            throttledSetLiveAppEvents([...overviewCaptureEvents]);
            const uiStatus = getPhaseAwareStatusForEvent({ 
              statusKey: appEvent.statusKey || 'skipped', 
              phase: 'capture', 
              reason: appEvent.reason 
            });
            throttledSetProgress('capture', {
              message: 'Scanning applications...',
              detail: `${uiStatus.longLabel}: ${ndjsonEvent.id}`
            });
          } else if (isArtifactEvent(ndjsonEvent)) {
            const artifactEvent: AppEvent = {
              app: 'Manifest',
              action: `Saved to ${ndjsonEvent.path}`,
              timestamp: Date.now(),
              statusKey: 'installed',
              phase: 'capture',
            };
            overviewCaptureEvents.push(artifactEvent);
            throttledSetLiveAppEvents([...overviewCaptureEvents]);
          }
        },
      }
    );

    flushLiveUpdates();
    logBufferRef.current?.flush();
    setIsRunning(false);

    const isSuccess = captureResult.envelope?.success ?? (captureResult.exitCode === 0);
    
    if (!isSuccess) {
      const errorCode = captureResult.envelope?.error?.code;
      const errorMessage = captureResult.envelope?.error?.message || 'Capture failed';
      const errorHint = captureResult.envelope?.error?.hint;
      
      // INV-CAPTURE-3: Surface ENGINE_CLI_NOT_FOUND with actionable hint
      if (errorCode === 'ENGINE_CLI_NOT_FOUND') {
        throw new Error(errorHint || 'Engine CLI not found. Configure Engine path in Settings.');
      }
      
      throw new Error(errorMessage);
    }

    // Get envelope data from engine response
    const envelopeData = captureResult.envelope?.data as EndstateCaptureData | undefined;
    
    // DEV INVESTIGATION: Log raw capture envelope to determine if bug is GUI or Engine
    if (import.meta.env.DEV) {
      console.log('[CAPTURE] raw envelope:', captureResult.envelope);
      console.log(
        '[CAPTURE] envelope.data keys:',
        captureResult.envelope?.data
          ? Object.keys(captureResult.envelope.data as object)
          : null
      );
      console.log(
        '[CAPTURE] appsIncluded:',
        (captureResult.envelope?.data as EndstateCaptureData | undefined)?.appsIncluded
      );
      console.log(
        '[CAPTURE] appsIncluded length:',
        (captureResult.envelope?.data as EndstateCaptureData | undefined)?.appsIncluded?.length ?? 'undefined/null'
      );
      console.log(
        '[CAPTURE] counts:',
        (captureResult.envelope?.data as EndstateCaptureData | undefined)?.counts
      );
      console.log(
        '[CAPTURE] outputPath from envelope:',
        (captureResult.envelope?.data as EndstateCaptureData | undefined)?.outputPath
      );
    }
    
    // Show warning toast if fallback capture was used
    if (envelopeData?.captureWarnings?.includes('WINGET_EXPORT_FAILED_FALLBACK_USED')) {
      showToast('Winget export failed; captured winget-managed apps only.', 'warning');
    }
    
    // CANONICAL SOURCE (Option A): envelope.data.appsIncluded is the ONLY truth
    // No NDJSON fallback - if appsIncluded is empty, report 0 apps captured
    const appsIncluded = envelopeData?.appsIncluded ?? [];
    const capturedCount = appsIncluded.length;
    
    // Dev warning: detect potential engine bug where counts.included > 0 but appsIncluded empty
    if (import.meta.env.DEV && (envelopeData?.counts?.included ?? 0) > 0 && appsIncluded.length === 0) {
      console.warn('[DEV] Engine reported counts.included > 0 but appsIncluded is empty. This may indicate an engine bug.');
    }

    // Persist run artifacts (logs, diagnostics, summary)
    if (runBundle) {
      const durationMs = Date.now() - runStartTime;
      const logContent = captureResult.stdout + '\n\n=== STDERR ===\n\n' + captureResult.stderr;
      await writeLog(runBundle, logContent);
      
      const diagnostics = generateDiagnosticsText({
        command: 'capture',
        mode: 'capture',
        outputPath,
        counts: { captured: capturedCount },
        apps: envelopeData?.appsIncluded?.map(a => a.id),
      });
      await writeDiagnostics(runBundle, diagnostics);
      
      await writeSummary(runBundle, {
        runId,
        command: 'capture',
        mode: 'capture',
        timestamp: new Date().toISOString(),
        outcome: isSuccess ? 'success' : 'failed',
        counts: { captured: capturedCount },
        durationMs,
        artifactPaths: {
          logFile: runBundle.logPath,
          eventsFile: runBundle.eventsPath,
        },
      });
    }

    // Update state with results
    const captureEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      success: true,
      summary: { total: capturedCount },
      artifactPaths: runBundle ? {
        logFile: runBundle.logPath,
        eventsFile: runBundle.eventsPath,
        bundleDir: runBundle.directory,
      } : undefined,
    };
    const newLifecycleState = recordLifecycleEvent('capture', captureEvent);
    setLifecycleState(newLifecycleState);
    
    // Get app list from canonical source (appsIncluded)
    const appsList = appsIncluded.map(a => a.id);
    
    // Read manifest content from temp file
    // The engine may write to a different path than --out (e.g. ZIP format in Profiles dir),
    // so we try multiple sources: --out path, envelope outputPath, then construct from envelope data.
    let draftText = '';
    const envelopeOutputPath = envelopeData?.outputPath;

    // Try 1: Read from the GUI-specified --out path (.jsonc)
    try {
      draftText = await invoke<string>('read_text_file', { path: outputPath });
    } catch {
      // File not found at --out path - try envelope's outputPath if different and is .jsonc
      if (envelopeOutputPath && envelopeOutputPath !== outputPath && envelopeOutputPath.endsWith('.jsonc')) {
        try {
          draftText = await invoke<string>('read_text_file', { path: envelopeOutputPath });
        } catch {
          // Also not readable
        }
      }
    }

    // Try 2: If still empty and engine output is ZIP (bundle with configs), construct manifest from envelope data
    if (!draftText && appsIncluded.length > 0) {
      if (import.meta.env.DEV) {
        console.log('[CAPTURE] Output file not readable, constructing manifest from envelope data');
      }
      const manifest = {
        version: '1.0',
        apps: appsIncluded.map(a => ({ source: a.source, id: a.id })),
      };
      draftText = JSON.stringify(manifest, null, 2);
    }

    // Validate draft content is non-empty and contains manifest structure
    if (!draftText || draftText.trim() === '' || draftText.trim() === '{}') {
      throw new Error('Capture output is empty or invalid. Please try again.');
    }

    // DEV INVESTIGATION: Log draftText to see if manifest contains apps
    if (import.meta.env.DEV) {
      console.log('[CAPTURE] draftText length:', draftText.length);
      console.log('[CAPTURE] outputPath:', outputPath);
      console.log('[CAPTURE] envelope outputPath:', envelopeOutputPath);
    }

    // Delete temp file immediately after reading (skip in DEV to allow inspection)
    if (!import.meta.env.DEV) {
      try {
        await invoke('delete_file_silent', { path: outputPath });
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Return structured result with draft text and canonical app list for modal
    // INVARIANT: count, apps, and appsIncluded ALL derive from envelope.data.appsIncluded
    return { count: capturedCount, draftText, apps: appsList, appsIncluded, envelopeData };
  };

  const handlePreviewFromOverview = async () => {
    if (!selectedProfile) {
      throw new Error('Please select a setup profile');
    }

    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });
    applyLineBufferRef.current = new StreamingLineBuffer();

    // Create run artifact bundle
    const dir = await loadProfilesDirectory();
    if (!dir) {
      throw new Error('Failed to determine profiles directory');
    }
    const runId = generateRunId();
    const runBundle = await createRunBundle(dir, runId);
    const runStartTime = Date.now();

    // Track preview live activity via NDJSON events
    const previewAppEvents: AppEvent[] = [];
    let previewPhase: EnginePhase = 'apply';
    
    const applyResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      ['--profile', selectedProfilePath, '--dry-run'],
      (event: StreamEvent) => {
        // Collect raw output for Technical Details only
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
        }
      },
      {
        enableNdjsonEvents: true,
        onNdjsonEvent: (ndjsonEvent: import('./lib/streaming-events').StreamingEvent) => {
          if (isPhaseEvent(ndjsonEvent)) {
            previewPhase = ndjsonEvent.phase;
          } else if (isItemEvent(ndjsonEvent)) {
            const appEvent = itemEventToAppEvent(ndjsonEvent, previewPhase);
            previewAppEvents.push(appEvent);
            // Bounded buffer: keep up to 2000 events for scrollback
            throttledSetLiveAppEvents(previewAppEvents.length > 2000 ? previewAppEvents.slice(-2000) : [...previewAppEvents]);
            const uiStatus = getPhaseAwareStatusForEvent({
              statusKey: appEvent.statusKey || 'skipped',
              phase: 'apply',
              reason: appEvent.reason,
            });
            throttledSetProgress('setup', {
              message: 'Evaluating changes',
              detail: `${uiStatus.longLabel}: ${ndjsonEvent.id}`
            });
          }
        },
      }
    );
    
    // Flush any pending throttled updates before processing result
    flushLiveUpdates();

    // Use collected events from NDJSON streaming
    const collectedEvents = [...previewAppEvents];

    logBufferRef.current?.flush();
    applyLineBufferRef.current?.clear();
    setIsRunning(false);

    // Process result
    const envelopeData = applyResult.envelope?.data as EndstateApplyResultData | undefined;
    const installed = envelopeData?.counts?.installed ?? 0;
    const alreadyPresent = envelopeData?.counts?.alreadyInstalled ?? 0;
    
    // Persist run artifacts (logs, diagnostics, summary)
    if (runBundle) {
      const durationMs = Date.now() - runStartTime;
      const logContent = applyResult.stdout + '\n\n=== STDERR ===\n\n' + applyResult.stderr;
      await writeLog(runBundle, logContent);
      
      const diagnostics = generateDiagnosticsText({
        command: 'apply',
        mode: 'preview',
        profileName: selectedProfile,
        profilePath: selectedProfilePath,
        counts: { installed, alreadyPresent },
      });
      await writeDiagnostics(runBundle, diagnostics);
      
      await writeSummary(runBundle, {
        runId,
        command: 'apply',
        mode: 'preview',
        timestamp: new Date().toISOString(),
        profileName: selectedProfile,
        profilePath: selectedProfilePath,
        outcome: 'success',
        counts: { installed, alreadyPresent },
        durationMs,
        artifactPaths: {
          logFile: runBundle.logPath,
          eventsFile: runBundle.eventsPath,
        },
      });
    }
    
    // Record lifecycle event
    const previewEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      profile: selectedProfile,
      profilePath: selectedProfilePath,
      success: true,
      summary: { installed, alreadyPresent },
      artifactPaths: runBundle ? {
        logFile: runBundle.logPath,
        eventsFile: runBundle.eventsPath,
        bundleDir: runBundle.directory,
      } : undefined,
    };
    const newState = recordLifecycleEvent('preview', previewEvent);
    setLifecycleState(newState);
    
    setOverviewActionProgress('setup', { 
      message: `${installed} to install, ${alreadyPresent} already present` 
    });
    
    return { installed, alreadyPresent, profile: selectedProfile, appEvents: collectedEvents };
  };

  const handleCheckFromOverview = async () => {
    if (!selectedProfile) {
      throw new Error('Please select a setup profile');
    }

    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });
    applyLineBufferRef.current = new StreamingLineBuffer();

    // Track check live activity via NDJSON events
    const checkAppEvents: AppEvent[] = [];
    const counters = { confirmed: 0, missing: 0, skipped: 0 };
    
    // Clear previous live events for fresh check run
    setLiveAppEvents([]);
    setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0, configsRestored: 0, configsSkipped: 0, configsFailed: 0 });
    
    // Use apply --dry-run for checking (same as preview)
    const checkResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      ['--profile', selectedProfilePath, '--dry-run'],
      (event: StreamEvent) => {
        // Collect raw output for Technical Details only
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
        }
      },
      {
        enableNdjsonEvents: true,
        onNdjsonEvent: (ndjsonEvent: import('./lib/streaming-events').StreamingEvent) => {
          // Phase events are ignored for Check flow - we always use 'verify' phase semantics
          if (isItemEvent(ndjsonEvent)) {
            // Force verify phase for UI display since this is a Check operation
            const appEvent = itemEventToAppEvent(ndjsonEvent, 'verify');
            checkAppEvents.push(appEvent);
            
            // Update counters based on verify semantics
            const statusKey = appEvent.statusKey || 'skipped';
            if (statusKey === 'present' || statusKey === 'installed') {
              counters.confirmed++;
            } else if (statusKey === 'to_install') {
              counters.missing++;
            } else if (statusKey === 'skipped') {
              counters.skipped++;
            }
            
            // Update live events for UI streaming (throttled for smooth drip)
            throttledSetLiveAppEvents(
              checkAppEvents.length > 2000 ? checkAppEvents.slice(-2000) : [...checkAppEvents],
              {
                installed: 0,
                alreadyPresent: counters.confirmed,
                skipped: counters.skipped,
                failed: counters.missing,
                configsRestored: 0,
                configsSkipped: 0,
                configsFailed: 0,
              }
            );
            
            const uiStatus = getPhaseAwareStatusForEvent({
              statusKey,
              phase: 'verify',
              reason: appEvent.reason,
            });
            
            // Build counter text for progress detail
            const parts: string[] = [];
            if (counters.confirmed > 0) parts.push(`${counters.confirmed} confirmed`);
            if (counters.missing > 0) parts.push(`${counters.missing} missing`);
            if (counters.skipped > 0) parts.push(`${counters.skipped} skipped`);
            const counterText = parts.join(' · ') || 'Checking…';
            
            throttledSetProgress('check', {
              message: `${uiStatus.longLabel}: ${ndjsonEvent.id}`,
              detail: counterText,
              phase: 'verify'
            });
          }
        },
      }
    );
    
    // Use collected events from NDJSON streaming
    // Flush any pending throttled updates before processing result
    flushLiveUpdates();

    const collectedEvents = [...checkAppEvents];

    logBufferRef.current?.flush();
    applyLineBufferRef.current?.clear();
    setIsRunning(false);

    // Process result
    const envelopeData = checkResult.envelope?.data as EndstateApplyResultData | undefined;
    const missing = envelopeData?.counts?.installed ?? 0; // "installed" in dry-run = would install = missing
    const present = envelopeData?.counts?.alreadyInstalled ?? 0;
    
    // Record lifecycle event as verify
    // Note: verify/check doesn't create a run bundle currently
    const verifyEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      profile: selectedProfile,
      profilePath: selectedProfilePath,
      success: true,
      summary: { missing, alreadyPresent: present },
    };
    const newState = recordLifecycleEvent('verify', verifyEvent);
    setLifecycleState(newState);
    
    if (missing > 0) {
      setOverviewActionProgress('check', { message: `${formatCount(missing, 'app')} missing, ${formatCount(present, 'app')} present` });
    } else {
      setOverviewActionProgress('check', { message: `All ${formatCount(present, 'app')} present` });
    }
    
    return { missing, present, profile: selectedProfile, appEvents: collectedEvents };
  };

  const handleApplyFromOverview = async (restoreOptions?: { restoreIntent?: import('./types').RestoreIntent; selectedModules?: string[] }) => {
    if (!selectedProfile) {
      throw new Error('Please select a setup profile');
    }

    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });
    applyLineBufferRef.current = new StreamingLineBuffer();

    // Create run artifact bundle
    const dir = await loadProfilesDirectory();
    if (!dir) {
      throw new Error('Failed to determine profiles directory');
    }
    const runId = generateRunId();
    const runBundle = await createRunBundle(dir, runId);
    const runStartTime = Date.now();

    // Track apply live activity via NDJSON events
    const appEventList: AppEvent[] = [];
    const appEventIndex = new Map<string, number>();
    const counters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0, configsRestored: 0, configsSkipped: 0, configsFailed: 0 };
    const verifyCounters = { confirmed: 0, missing: 0, total: 0 };
    let currentPhase: EnginePhase = 'apply';
    let hasInsertedApplyHeader = false;
    let hasInsertedVerifyHeader = false;
    
    // Build apply command args with optional restore flags
    const applyArgs = ['--profile', selectedProfilePath];
    if (restoreOptions?.restoreIntent === 'apps-and-settings') {
      applyArgs.push('--enable-restore');
      if (restoreOptions.selectedModules && restoreOptions.selectedModules.length > 0) {
        applyArgs.push('--restore-filter', restoreOptions.selectedModules.join(','));
      }
    }

    const applyResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      applyArgs,
      (event: StreamEvent) => {
        // Collect raw output for Technical Details only
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
        }
      },
      {
        enableNdjsonEvents: true,
        onNdjsonEvent: (ndjsonEvent: import('./lib/streaming-events').StreamingEvent) => {
          // Handle phase transitions
          if (isPhaseEvent(ndjsonEvent)) {
            const newPhase = ndjsonEvent.phase;
            // Insert APPLY phase header at start
            if (newPhase === 'apply' && !hasInsertedApplyHeader) {
              hasInsertedApplyHeader = true;
              const applyHeaderEvent: AppEvent = { 
                app: '── APPLY ──', 
                action: '', 
                timestamp: Date.now(),
                phase: 'apply'
              };
              appEventList.push(applyHeaderEvent);
              throttledSetLiveAppEvents([...appEventList]);
            }
            // Insert VERIFY phase header when transitioning to verify phase
            if (currentPhase === 'apply' && newPhase === 'verify' && !hasInsertedVerifyHeader) {
              hasInsertedVerifyHeader = true;
              const verifyHeaderEvent: AppEvent = {
                app: '── VERIFY ──',
                action: '',
                timestamp: Date.now(),
                phase: 'verify'
              };
              appEventList.push(verifyHeaderEvent);
              throttledSetLiveAppEvents([...appEventList]);
              throttledSetProgress('setup', {
                message: 'Verifying installation…',
                detail: undefined,
                phase: 'verify'
              });
            }
            currentPhase = newPhase;
          } 
          // Handle item events
          else if (isItemEvent(ndjsonEvent)) {
            const appEvent = itemEventToAppEvent(ndjsonEvent, currentPhase);
            
            // Update or append event
            const existingIndex = appEventIndex.get(ndjsonEvent.id);
            if (existingIndex !== undefined) {
              const existing = appEventList[existingIndex];
              // Update counters on status change
              const isFinal = ['installed', 'present', 'skipped', 'failed'].includes(appEvent.statusKey || '');
              const wasNonFinal = existing.statusKey === 'installing' || existing.statusKey === 'to_install';
              if (isFinal && wasNonFinal) {
                if (appEvent.statusKey === 'installed') counters.installed++;
                else if (appEvent.statusKey === 'present') counters.alreadyPresent++;
                else if (appEvent.statusKey === 'skipped') counters.skipped++;
                else if (appEvent.statusKey === 'failed') counters.failed++;
              }
              appEventList[existingIndex] = appEvent;
            } else {
              appEventIndex.set(ndjsonEvent.id, appEventList.length);
              appEventList.push(appEvent);
            }
            
            // Track verify phase counters separately
            if (currentPhase === 'verify') {
              verifyCounters.total++;
              if (appEvent.statusKey === 'present' || appEvent.statusKey === 'installed') {
                verifyCounters.confirmed++;
              } else if (appEvent.statusKey === 'to_install' || appEvent.statusKey === 'failed') {
                verifyCounters.missing++;
              }
            }
            
            // Update live events for UI (throttled for smooth drip)
            throttledSetLiveAppEvents(
              appEventList.length > 2000 ? appEventList.slice(-2000) : [...appEventList],
              { ...counters }
            );
            
            // Build progress message based on current phase
            const uiStatus = getPhaseAwareStatusForEvent({
              statusKey: appEvent.statusKey || 'skipped',
              phase: currentPhase === 'verify' ? 'verify' : 'apply',
              reason: appEvent.reason,
            });
            
            if (currentPhase === 'verify') {
              // Verify phase: show verify progress counter
              const manifestTotal = counters.installed + counters.alreadyPresent + counters.skipped + counters.failed;
              const verifyProgress = manifestTotal > 0 
                ? `Verifying… ${verifyCounters.total}/${manifestTotal}`
                : `Verifying… (${verifyCounters.total} checked)`;
              throttledSetProgress('setup', {
                message: `${uiStatus.longLabel}: ${ndjsonEvent.id}`,
                detail: verifyProgress,
                phase: 'verify'
              });
            } else {
              // Apply phase: show apply counters
              const parts: string[] = [];
              if (counters.installed > 0) parts.push(`${counters.installed} installed`);
              if (counters.alreadyPresent > 0) parts.push(`${counters.alreadyPresent} already present`);
              if (counters.skipped > 0) parts.push(`${counters.skipped} skipped`);
              if (counters.failed > 0) parts.push(`${counters.failed} failed`);
              const counterText = parts.join(' · ') || 'Working…';

              throttledSetProgress('setup', {
                message: `${uiStatus.longLabel}: ${ndjsonEvent.id}`,
                detail: counterText,
                phase: 'apply'
              });
            }
          }
          // Handle restore-item events
          else if (isRestoreItemEvent(ndjsonEvent)) {
            // Map restore status to a display-friendly AppEvent
            const statusLabel = ndjsonEvent.status === 'restored' ? 'RESTORED'
              : ndjsonEvent.status === 'restoring' ? 'RESTORING'
              : ndjsonEvent.status === 'skipped_up_to_date' ? 'UP TO DATE'
              : ndjsonEvent.status === 'skipped_missing_source' ? 'MISSING'
              : 'FAILED';
            const restoreAppEvent: AppEvent = {
              app: `\u2699 ${ndjsonEvent.module}/${ndjsonEvent.id}`,
              action: statusLabel,
              timestamp: Date.now(),
              statusKey: ndjsonEvent.status === 'restored' ? 'installed'
                : ndjsonEvent.status === 'restoring' ? 'installing'
                : ndjsonEvent.status === 'failed' ? 'failed'
                : 'skipped',
              phase: 'apply',
              reason: ndjsonEvent.reason,
            };

            // Always append (don't deduplicate restore items by id)
            appEventList.push(restoreAppEvent);

            // Update restore counters
            if (ndjsonEvent.status === 'restored') counters.configsRestored++;
            else if (ndjsonEvent.status === 'skipped_up_to_date' || ndjsonEvent.status === 'skipped_missing_source') counters.configsSkipped++;
            else if (ndjsonEvent.status === 'failed') counters.configsFailed++;
            throttledSetLiveAppEvents(
              appEventList.length > 2000 ? appEventList.slice(-2000) : [...appEventList],
              { ...counters }
            );

            // Update progress message
            throttledSetProgress('setup', {
              message: `Restoring: ${ndjsonEvent.module}`,
              detail: `${counters.configsRestored} restored`,
              phase: 'apply',
            });
          }
        },
      }
    );

    // Flush any pending throttled updates before processing result
    flushLiveUpdates();

    logBufferRef.current?.flush();
    applyLineBufferRef.current?.clear();
    setIsRunning(false);

    // Process result - envelope is source of truth
    const envelopeData = applyResult.envelope?.data as EndstateApplyResultData | undefined;
    const envelopeItems = envelopeData?.items ?? [];
    
    // CRITICAL: Reconcile live activity with final envelope
    // This ensures "Working..." entries are updated to their final status (Failed, Installed, etc.)
    const reconciledEvents = reconcileLiveActivity(appEventList, envelopeItems);
    // Bounded buffer: keep up to 2000 events for scrollback
    setLiveAppEvents(reconciledEvents.length > 2000 ? reconciledEvents.slice(-2000) : reconciledEvents);
    
    // Update counters from envelope (source of truth)
    const installed = envelopeData?.counts?.installed ?? 0;
    const alreadyPresent = envelopeData?.counts?.alreadyInstalled ?? 0;
    const failed = envelopeData?.counts?.failed ?? 0;
    const skipped = envelopeData?.counts?.skippedFiltered ?? 0;
    
    // Extract restore counters from envelope
    const restoreSummary = envelopeData?.restoreSummary;
    setLiveCounters({
      installed, alreadyPresent, skipped, failed,
      configsRestored: restoreSummary?.restored ?? 0,
      configsSkipped: restoreSummary?.skipped ?? 0,
      configsFailed: restoreSummary?.failed ?? 0,
    });

    // Determine success: envelope.success is authoritative
    // Partial failure = success:false but error:null with failed > 0
    const isSuccess = applyResult.envelope?.success ?? (applyResult.exitCode === 0);
    const isPartialFailure = !isSuccess && applyResult.envelope?.error === null && failed > 0;
    
    // Only throw for hard errors, not partial failures
    if (!isSuccess && !isPartialFailure) {
      throw new Error(applyResult.envelope?.error?.message || 'Apply failed');
    }
    
    // Persist run artifacts (logs, diagnostics, summary)
    if (runBundle) {
      const durationMs = Date.now() - runStartTime;
      const logContent = applyResult.stdout + '\n\n=== STDERR ===\n\n' + applyResult.stderr;
      await writeLog(runBundle, logContent);
      
      const diagnostics = generateDiagnosticsText({
        command: 'apply',
        mode: 'apply',
        profileName: selectedProfile,
        profilePath: selectedProfilePath,
        counts: { installed, alreadyPresent, skipped, failed },
      });
      await writeDiagnostics(runBundle, diagnostics);
      
      await writeSummary(runBundle, {
        runId,
        command: 'apply',
        mode: 'apply',
        timestamp: new Date().toISOString(),
        profileName: selectedProfile,
        profilePath: selectedProfilePath,
        outcome: isSuccess ? (failed > 0 ? 'partial' : 'success') : 'failed',
        counts: { installed, alreadyPresent, skipped, failed },
        durationMs,
        artifactPaths: {
          logFile: runBundle.logPath,
          eventsFile: runBundle.eventsPath,
        },
      });
    }
    
    // Record lifecycle event
    const applyEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      profile: selectedProfile,
      profilePath: selectedProfilePath,
      success: isSuccess,
      summary: { installed, alreadyPresent, failed },
      artifactPaths: runBundle ? {
        logFile: runBundle.logPath,
        eventsFile: runBundle.eventsPath,
        bundleDir: runBundle.directory,
      } : undefined,
    };
    const newState = recordLifecycleEvent('apply', applyEvent);
    setLifecycleState(newState);
    
    // Update progress message based on outcome
    if (failed > 0) {
      setOverviewActionProgress('setup', { 
        message: `${installed} installed, ${failed} failed`,
        detail: `${alreadyPresent} already present`
      });
    } else {
      setOverviewActionProgress('setup', { 
        message: `${installed} installed, ${alreadyPresent} already present` 
      });
    }
    
    return {
      installed, alreadyPresent, failed, skipped,
      profile: selectedProfile,
      appEvents: reconciledEvents,
      restoreItems: envelopeData?.restoreItems,
      restoreSummary,
      restoreJournalFile: envelopeData?.restoreJournalFile,
      restoreModulesAvailable: envelopeData?.restoreModulesAvailable,
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Ctrl+, opens Settings (emergency shortcut)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setCurrentPage('settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!settings.engineMode || (settings.engineMode === 'script' && !settings.engineScriptPath)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Welcome to Endstate GUI</CardTitle>
            <CardDescription>Please configure your endstate engine to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCurrentPage('settings')}>
              Open Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border bg-panel px-6 flex items-center">
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto p-6 space-y-8">
              {/* Skeleton profile bar */}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border">
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </div>
              {/* Skeleton action cards */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-muted rounded-lg animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-52 bg-muted/60 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Helper to get runtime diagnostics
  const getDiagnostics = () => {
    const inTauri = isTauriRuntime();
    return {
      runtime: inTauri ? 'tauri' : 'web',
      tauriPlatform: import.meta.env.TAURI_PLATFORM || 'not set',
      hasTauriInternals: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
      hasTauriIpc: typeof window !== 'undefined' && '__TAURI_IPC__' in window,
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      engineMode: settings.engineMode,
      engineScriptPath: settings.engineScriptPath,
      safeMode,
      errorMessage: state.errorMessage,
      errorCommand: state.errorCommand,
    };
  };

  const copyDiagnostics = async () => {
    const diag = getDiagnostics();
    const text = Object.entries(diag)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    await diagnosticsCopyFeedback.triggerAsync(
      () => copyText(text),
      'Copied',
      'Copy failed'
    );
  };

  // Error banner component - slim warning bar with expandable details
  const renderErrorBanner = () => {
    if (state.status !== 'error') return null;

    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 mb-4">
        {/* Compact bar */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
            <span className="text-sm text-foreground font-medium truncate">Engine not connected</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              — {state.errorMessage || 'Run in Tauri or enable mock mode'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={loadInitialData}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
              setSafeMode(true);
              setState(prev => ({ ...prev, status: 'ready' }));
            }}>
              Safe Mode
            </Button>
          </div>
        </div>

        {/* Expandable details */}
        <details open={showDiagnostics} onToggle={(e) => setShowDiagnostics((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground px-4 pb-2 flex items-center gap-1">
            {showDiagnostics ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Diagnostics
          </summary>
          <div className="px-4 pb-3 space-y-2">
            {state.errorCommand && (
              <div className="text-xs">
                <span className="text-muted-foreground">Command: </span>
                <code className="bg-muted px-1 rounded">{state.errorCommand}</code>
              </div>
            )}
            <div className="p-2 bg-muted/50 rounded text-xs space-y-1 font-mono">
              {Object.entries(getDiagnostics()).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{key}: </span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
            <Button
              ref={diagnosticsCopyFeedback.buttonRef}
              size="sm"
              variant="ghost"
              className="h-7 text-xs relative"
              onClick={copyDiagnostics}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy Diagnostics
              <InlineFeedbackPopover feedback={diagnosticsCopyFeedback.feedback} />
            </Button>
            {state.errorStderr && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  STDERR output
                </summary>
                <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">{state.errorStderr}</pre>
              </details>
            )}
          </div>
        </details>
      </div>
    );
  };

  // Note: Error state no longer blocks UI - it shows a banner instead

  const renderPage = () => {
    // Show error banner at top of any page when in error state
    const errorBanner = renderErrorBanner();

    switch (currentPage) {
      case 'landing':
        return (
          <div>
            {errorBanner}
            <IntentLanding
              onSelectSave={() => setCurrentPage('save')}
              onSelectSetup={() => setCurrentPage('setup')}
              engineConnected={state.status !== 'error'}
            />
          </div>
        );

      case 'save':
        return (
          <div className="space-y-6">
            {errorBanner}
            <SaveFlow onBack={() => setCurrentPage('landing')} />
          </div>
        );

      case 'setup':
        return (
          <div className="space-y-6">
            {errorBanner}
            <SetupFlow
              profiles={profiles}
              onBack={() => setCurrentPage('landing')}
              onProfileSelect={(profile) => {
                setSelectedProfile(profile.name);
                setSelectedProfilePath(profile.path);
                updateSettings({ selectedProfileName: profile.name });
              }}
              onOpenProfilesFolder={handleOpenProfilesFolder}
              onRefreshProfiles={refreshProfiles}
              onFileDrop={() => {
                // TODO: Implement zip/manifest import (ADR-001)
                showToast('File import not yet implemented', 'info');
              }}
            />
          </div>
        );

      case 'overview':
        return (
          <div className="space-y-6">
            {errorBanner}
            <OverviewScreen
              sidebarVisible={sidebarVisible}
              engineConnected={state.status !== 'error'}
              lifecycleState={lifecycleState}
              selectedProfile={selectedProfile}
              profiles={profiles}
              profilesDirectory={profilesDirectory}
              isRunning={isRunning}
              runningAction={overviewRunningAction}
              actionStatus={overviewActionStatus}
              actionProgress={overviewActionProgress}
              actionResult={overviewActionResult}
              actionStatusByAction={actionStatusByAction}
              actionProgressByAction={actionProgressByAction}
              actionResultByAction={actionResultByAction}
              liveAppEvents={liveAppEvents}
              liveCounters={liveCounters}
              initialExpandedCard={overviewExpandedCard}
              lastSavedProfileSummary={lastSavedProfileSummary}
              onNavigate={navigateWithHistory}
              onClearExpandedCard={() => setOverviewExpandedCard(null)}
              onCapture={async () => {
                // Double-run guard with runId
                const runId = `capture-${Date.now()}`;
                if (isRunning || isRunningRef.current || activeRunIdRef.current) {
                  if (import.meta.env.DEV) {
                    console.warn(`[DOUBLE-RUN BLOCKED] Capture attempt blocked. Active run: ${activeRunIdRef.current}, new runId: ${runId}`);
                  }
                  return;
                }
                isRunningRef.current = true;
                activeRunIdRef.current = runId;
                setActiveRunId(runId);
                setIsRunning(true);
                if (import.meta.env.DEV) {
                  console.log(`[RUN START] Capture runId=${runId}`);
                }
                setOverviewRunningAction('capture');
                setOverviewActionStatus('capture', 'running');
                setOverviewActionProgress('capture', { message: 'Scanning installed applications...' });
                
                // Clear previous summary and draft when starting new capture
                setLastSavedProfileSummary(null);
                setPendingCaptureDraft(null);
                try {
                  const result = await handleCaptureFromOverview();
                  setOverviewActionStatus('capture', 'success');
                  const configCount = getCapturedConfigCount(result.envelopeData);
                  const countText = deriveCaptureSummaryText(result.count, configCount);
                  setOverviewActionProgress('capture', { message: countText });

                  // Store draft in memory and localStorage
                  const draft = {
                    capturedAppsCount: result.count,
                    capturedAt: new Date().toISOString(),
                    draftText: result.draftText,
                    apps: result.apps,
                  };
                  setPendingCaptureDraft(draft);

                  // Persist draft to Tauri Store for reload survival
                  await saveDraft({
                    text: result.draftText,
                    createdAt: draft.capturedAt,
                    appCount: result.count,
                  });

                  // DO NOT set lastSavedProfileSummary here
                  // Green success only appears after Save Profile (in handleSaveProfileName)

                  // Use helper with canonical CapturedApp[] to build modal model (INV-DETAILS-1)
                  setOverviewActionResult('capture', buildCaptureActionResult(result.appsIncluded, countText, {
                    outputFormat: result.envelopeData?.outputFormat,
                    configsIncluded: result.envelopeData?.configsIncluded,
                    configsSkipped: result.envelopeData?.configsSkipped,
                    configsCaptureErrors: result.envelopeData?.configsCaptureErrors,
                    configModules: result.envelopeData?.configModules,
                  }));
                  
                  // Prompt for profile name after state is set
                  await promptForProfileName('');
                } catch (err) {
                  setOverviewActionStatus('capture', 'error');
                  setOverviewActionResult('capture', {
                    action: 'capture',
                    status: 'error',
                    summary: err instanceof Error ? err.message : 'Capture failed'
                  });
                } finally {
                  if (import.meta.env.DEV) {
                    console.log(`[RUN END] Capture runId=${runId}`);
                  }
                  isRunningRef.current = false;
                  activeRunIdRef.current = null;
                  setActiveRunId(null);
                  setIsRunning(false);
                  setOverviewRunningAction(null);
                }
              }}
              onSetup={async (intent: 'preview' | 'apply', restoreOptions?: import('./components/app/overview/types').RestoreOptions) => {
                // Double-run guard with runId
                const runId = `setup-${intent}-${Date.now()}`;
                if (isRunning || isRunningRef.current || activeRunIdRef.current) {
                  if (import.meta.env.DEV) {
                    console.warn(`[DOUBLE-RUN BLOCKED] Setup ${intent} attempt blocked. Active run: ${activeRunIdRef.current}, new runId: ${runId}`);
                  }
                  return;
                }
                isRunningRef.current = true;
                activeRunIdRef.current = runId;
                setActiveRunId(runId);
                setIsRunning(true);
                if (import.meta.env.DEV) {
                  console.log(`[RUN START] Setup ${intent} runId=${runId}`);
                }
                setLiveAppEvents([]);
                setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0, configsRestored: 0, configsSkipped: 0, configsFailed: 0 });
                
                // CRITICAL: Set runningAction BEFORE calling helper functions
                // The helpers check if overviewRunningAction exists before updating state
                setOverviewRunningAction('setup');
                
                setOverviewActionStatus('setup', 'running');
                const isApply = intent === 'apply';
                setOverviewActionProgress('setup', { 
                  message: isApply ? 'Installing applications...' : 'Evaluating changes',
                  phase: isApply ? 'apply' : 'preview'
                });
                try {
                  if (isApply) {
                    const result = await handleApplyFromOverview(restoreOptions);
                    // Set status based on whether there were failures
                    const hasFailures = result.failed > 0;
                    setOverviewActionStatus('setup', hasFailures ? 'error' : 'success');
                    // Build summary including restore info if present
                    const restoreCount = result.restoreSummary?.restored ?? 0;
                    const baseSummary = hasFailures
                      ? `${result.installed} installed, ${result.failed} failed`
                      : `${result.installed} installed, ${result.alreadyPresent} already present`;
                    const fullSummary = restoreCount > 0
                      ? `${baseSummary}, ${restoreCount} settings restored`
                      : baseSummary;

                    setOverviewActionResult('setup', {
                      action: 'setup',
                      status: hasFailures ? 'error' : 'success',
                      summary: fullSummary,
                      profile: result.profile,
                      timestamp: new Date().toISOString(),
                      counts: {
                        installed: result.installed,
                        alreadyPresent: result.alreadyPresent,
                        skipped: result.skipped,
                        failed: result.failed,
                        manifestTotal: result.installed + result.alreadyPresent + result.skipped + result.failed,
                        configsRestored: result.restoreSummary?.restored,
                        configsSkipped: result.restoreSummary?.skipped,
                        configsErrored: result.restoreSummary?.failed,
                      },
                      appEvents: result.appEvents,
                      restoreItems: result.restoreItems,
                      restoreSummary: result.restoreSummary,
                      restoreJournalFile: result.restoreJournalFile,
                      restoreModulesAvailable: result.restoreModulesAvailable,
                    });
                  } else {
                    const result = await handlePreviewFromOverview();
                    setOverviewActionStatus('setup', 'success');
                    setOverviewActionResult('setup', { 
                      action: 'setup', 
                      status: 'success', 
                      summary: `${result.installed} to install, ${result.alreadyPresent} already present`,
                      profile: result.profile,
                      timestamp: new Date().toISOString(),
                      counts: {
                        toInstall: result.installed,
                        alreadyPresent: result.alreadyPresent,
                        manifestTotal: result.installed + result.alreadyPresent,
                      },
                      appEvents: result.appEvents,
                      wasPreview: true, // Flag for showing "Apply changes" button
                    });
                  }
                } catch (err) {
                  setOverviewActionStatus('setup', 'error');
                  setOverviewActionResult('setup', { 
                    action: 'setup', 
                    status: 'error', 
                    summary: err instanceof Error ? err.message : 'Setup failed' 
                  });
                } finally {
                  if (import.meta.env.DEV) {
                    console.log(`[RUN END] Setup ${intent} runId=${runId}`);
                  }
                  isRunningRef.current = false;
                  activeRunIdRef.current = null;
                  setActiveRunId(null);
                  setIsRunning(false);
                  setOverviewRunningAction(null);
                }
              }}
              onCheck={async () => {
                // Double-run guard with runId
                const runId = `check-${Date.now()}`;
                if (isRunning || isRunningRef.current || activeRunIdRef.current) {
                  if (import.meta.env.DEV) {
                    console.warn(`[DOUBLE-RUN BLOCKED] Check attempt blocked. Active run: ${activeRunIdRef.current}, new runId: ${runId}`);
                  }
                  return;
                }
                isRunningRef.current = true;
                activeRunIdRef.current = runId;
                setActiveRunId(runId);
                setIsRunning(true);
                if (import.meta.env.DEV) {
                  console.log(`[RUN START] Check runId=${runId}`);
                }
                
                setOverviewRunningAction('check');
                setOverviewActionStatus('check', 'running');
                setOverviewActionProgress('check', { message: 'Checking computer...' });
                try {
                  const result = await handleCheckFromOverview();
                  setOverviewActionStatus('check', 'success');
                  const summaryText = result.missing > 0 
                    ? `${formatCount(result.missing, 'app')} missing, ${formatCount(result.present, 'app')} present`
                    : `All ${formatCount(result.present, 'app')} present`;
                  setOverviewActionResult('check', { 
                    action: 'check', 
                    status: 'success', 
                    summary: summaryText,
                    profile: result.profile,
                    timestamp: new Date().toISOString(),
                    counts: {
                      missing: result.missing,
                      alreadyPresent: result.present,
                      manifestTotal: result.missing + result.present,
                    },
                    appEvents: result.appEvents,
                  });
                } catch (err) {
                  setOverviewActionStatus('check', 'error');
                  setOverviewActionResult('check', { 
                    action: 'check', 
                    status: 'error', 
                    summary: err instanceof Error ? err.message : 'Check failed' 
                  });
                } finally {
                  if (import.meta.env.DEV) {
                    console.log(`[RUN END] Check runId=${runId}`);
                  }
                  isRunningRef.current = false;
                  activeRunIdRef.current = null;
                  setActiveRunId(null);
                  setIsRunning(false);
                  setOverviewRunningAction(null);
                }
              }}
              onProfileChange={(profile: string, path: string) => {
                setSelectedProfile(profile);
                setSelectedProfilePath(path);
                updateSettings({ selectedProfileName: profile });
              }}
              onDismissResult={dismissOverviewResult}
              onOpenProfilesFolder={handleOpenProfilesFolder}
              onRefreshProfiles={refreshProfiles}
              onRenameProfile={(path: string, currentName: string) => {
                openProfileNameModal(path, currentName, 'rename');
              }}
              onDeleteProfile={(path: string, displayName: string) => {
                setDeleteProfilePath(path);
                setDeleteProfileName(displayName);
                setShowDeleteProfileModal(true);
              }}
              onSetActiveProfile={handleSetActiveProfile}
              onSaveProfile={() => {
                // Open the save modal for the pending capture draft (not selectedProfile)
                if (pendingCaptureDraft) {
                  promptForProfileName('');
                }
              }}
              onDiscardDraft={handleDiscardDraft}
              pendingCaptureDraft={pendingCaptureDraft}
            />
          </div>
        );

      case 'report':
        // Build recent runs from lifecycle state and last run data
        // Use artifactPaths from lifecycle events directly (source of truth)
        const recentRuns: Array<{
          id: string;
          timestamp: string;
          command: string;
          mode: 'preview' | 'apply' | 'capture' | 'verify';
          profile?: string;
          status: 'success' | 'partial' | 'failed';
          summary: { installed?: number; alreadyPresent?: number; failed?: number; captured?: number };
          artifactPaths?: { logFile?: string; eventsFile?: string; bundleDir?: string };
        }> = [];
        
        // Add from lifecycle state - include artifactPaths directly
        if (lifecycleState.lastApply) {
          recentRuns.push({
            id: `apply-${lifecycleState.lastApply.timestamp}`,
            timestamp: lifecycleState.lastApply.timestamp,
            command: 'apply',
            mode: 'apply',
            profile: lifecycleState.lastApply.profile,
            status: lifecycleState.lastApply.success 
              ? (lifecycleState.lastApply.summary?.failed ? 'partial' : 'success') 
              : 'failed',
            summary: {
              installed: lifecycleState.lastApply.summary?.installed,
              alreadyPresent: lifecycleState.lastApply.summary?.alreadyPresent,
              failed: lifecycleState.lastApply.summary?.failed,
            },
            artifactPaths: lifecycleState.lastApply.artifactPaths,
          });
        }
        
        if (lifecycleState.lastPreview) {
          recentRuns.push({
            id: `preview-${lifecycleState.lastPreview.timestamp}`,
            timestamp: lifecycleState.lastPreview.timestamp,
            command: 'apply --dry-run',
            mode: 'preview',
            profile: lifecycleState.lastPreview.profile,
            status: lifecycleState.lastPreview.success ? 'success' : 'failed',
            summary: {
              installed: lifecycleState.lastPreview.summary?.installed,
              alreadyPresent: lifecycleState.lastPreview.summary?.alreadyPresent,
              failed: lifecycleState.lastPreview.summary?.failed,
            },
            artifactPaths: lifecycleState.lastPreview.artifactPaths,
          });
        }
        
        if (lifecycleState.lastCapture) {
          recentRuns.push({
            id: `capture-${lifecycleState.lastCapture.timestamp}`,
            timestamp: lifecycleState.lastCapture.timestamp,
            command: 'capture',
            mode: 'capture',
            status: lifecycleState.lastCapture.success ? 'success' : 'failed',
            summary: {
              captured: lifecycleState.lastCapture.summary?.total,
            },
            artifactPaths: lifecycleState.lastCapture.artifactPaths,
          });
        }
        
        // Add from lastRunCapture/lastRunApply if not already in lifecycle (legacy, no artifact paths)
        if (lastRunCapture && !lifecycleState.lastCapture) {
          recentRuns.push({
            id: `capture-legacy-${lastRunCapture.timestamp}`,
            timestamp: lastRunCapture.timestamp,
            command: 'capture',
            mode: 'capture',
            status: lastRunCapture.outcome.failed ? 'partial' : 'success',
            summary: {
              captured: lastRunCapture.outcome.succeeded,
            },
          });
        }
        
        if (lastRunApply && !lifecycleState.lastApply) {
          recentRuns.push({
            id: `apply-legacy-${lastRunApply.timestamp}`,
            timestamp: lastRunApply.timestamp,
            command: 'apply',
            mode: 'apply',
            profile: lastRunApply.profile,
            status: lastRunApply.outcome.needsAttention ? 'partial' : 'success',
            summary: {
              installed: lastRunApply.outcome.installed,
              alreadyPresent: lastRunApply.outcome.alreadyPresent,
              failed: lastRunApply.outcome.needsAttention,
            },
          });
        }
        
        // Sort by timestamp descending
        recentRuns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Reports"
              subtitle="View recent activity and run history"
            />
            
            {/* Active run banner */}
            {activeRunId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Run in progress</p>
                      <p className="text-xs text-muted-foreground">
                        {overviewRunningAction === 'capture' ? 'Capturing applications...' :
                         overviewRunningAction === 'setup' ? 'Setting up applications...' :
                         overviewRunningAction === 'check' ? 'Checking computer...' :
                         'Running...'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleNavigate('overview')}
                  >
                    View details
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Recent Runs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Runs</CardTitle>
                <CardDescription>History of capture, preview, and apply operations</CardDescription>
              </CardHeader>
              <CardContent>
                {recentRuns.length > 0 ? (
                  <div className="space-y-3">
                    {recentRuns.map((run) => (
                      <details key={run.id} className="group border border-border rounded-lg">
                        <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              run.status === 'success' ? 'bg-success' : 
                              run.status === 'partial' ? 'bg-warning' : 'bg-destructive'
                            }`} />
                            <div>
                              <span className="font-medium capitalize">{run.mode}</span>
                              {run.profile && (
                                <span className="text-muted-foreground ml-2">• {run.profile}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{formatRelativeTime(run.timestamp)}</span>
                            <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                          </div>
                        </summary>
                        {/* Always show summary info when expanded - runs must remain clickable in all modes */}
                        <div className="px-3 pb-3 pt-1 border-t border-border bg-muted/30">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Command: </span>
                              <code className="text-xs bg-muted px-1 rounded">{run.command}</code>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Time: </span>
                              <span>{new Date(run.timestamp).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <span className={`font-medium ${
                                run.status === 'success' ? 'text-success' : 
                                run.status === 'partial' ? 'text-warning' : 'text-destructive'
                              }`}>
                                {run.status === 'success' ? 'Success' : 
                                 run.status === 'partial' ? 'Partial' : 'Failed'}
                              </span>
                            </div>
                            {run.mode === 'capture' && run.summary.captured !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Captured: </span>
                                <span className="font-medium">{run.summary.captured}</span>
                              </div>
                            )}
                            {(run.mode === 'apply' || run.mode === 'preview') && (
                              <>
                                {run.summary.installed !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      {run.mode === 'preview' ? 'To install: ' : 'Installed: '}
                                    </span>
                                    <span className="font-medium">{run.summary.installed}</span>
                                  </div>
                                )}
                                {run.summary.alreadyPresent !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Already present: </span>
                                    <span className="font-medium">{run.summary.alreadyPresent}</span>
                                  </div>
                                )}
                                {run.summary.failed !== undefined && run.summary.failed > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Failed: </span>
                                    <span className="font-medium text-destructive">{run.summary.failed}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          
                          {/* Artifact status and actions - only show in Advanced mode */}
                          {settings.showDetails && (
                          <div className="col-span-2 pt-2 border-t border-border mt-2">
                            {activeRunId && overviewRunningAction === run.mode ? (
                              <span className="text-xs text-muted-foreground italic">
                                Run in progress
                              </span>
                            ) : run.artifactPaths?.logFile ? (
                              <>
                                {/* Details disclosure - only shown when setting enabled */}
                                {settings.showDetails && (
                                  <details className="mb-2">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                      Details
                                    </summary>
                                    <div className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono space-y-1">
                                      <div><span className="text-muted-foreground">Log path:</span> {run.artifactPaths.logFile}</div>
                                      {run.artifactPaths.eventsFile && (
                                        <div><span className="text-muted-foreground">Events path:</span> {run.artifactPaths.eventsFile}</div>
                                      )}
                                    </div>
                                  </details>
                                )}
                                {settings.showDetails && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => openLogViewer(run.artifactPaths!.logFile!, `${run.mode.charAt(0).toUpperCase() + run.mode.slice(1)} Log`)}
                                    >
                                      <FileText className="h-3 w-3" />
                                      View log
                                    </Button>
                                    {isTauriRuntime() && run.artifactPaths.bundleDir && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={async () => {
                                          try {
                                            await openFolder(run.artifactPaths!.bundleDir!);
                                          } catch (err) {
                                            console.error('Failed to open folder:', err);
                                          }
                                        }}
                                      >
                                        <FolderOpen className="h-3 w-3" />
                                        Open folder
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No logs captured for this run
                              </span>
                            )}
                          </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No recent activity</p>
                )}
              </CardContent>
            </Card>
            
            {/* Persisted Run Artifacts */}
            {runArtifacts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Run Artifacts</CardTitle>
                  <CardDescription className="text-xs">Saved diagnostics and logs from recent runs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {runArtifacts.slice(0, 10).map(({ bundle, summary }) => (
                      <details key={bundle.runId} className="group border border-border rounded-lg">
                        <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              summary.outcome === 'success' ? 'bg-success' : 
                              summary.outcome === 'partial' ? 'bg-warning' : 'bg-destructive'
                            }`} />
                            <span className="text-sm font-medium capitalize">{summary.mode}</span>
                            {summary.profileName && (
                              <span className="text-xs text-muted-foreground">• {summary.profileName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatRelativeTime(summary.timestamp)}</span>
                            <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                          </div>
                        </summary>
                        <div className={`px-2 pb-2 pt-1 bg-muted/30 ${settings.showDetails ? 'border-t border-border' : ''}`}>
                          {/* Details disclosure - only shown when setting enabled */}
                          {settings.showDetails && (
                            <details className="mb-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Details
                              </summary>
                              <div className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono space-y-1">
                                <div><span className="text-muted-foreground">Run ID:</span> {summary.runId}</div>
                                <div><span className="text-muted-foreground">Log path:</span> {summary.artifactPaths?.logFile || bundle.logPath}</div>
                                <div><span className="text-muted-foreground">Events path:</span> {summary.artifactPaths?.eventsFile || 'N/A'}</div>
                              </div>
                            </details>
                          )}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {/* View log button - opens log viewer modal - gated behind showDetails */}
                            {settings.showDetails && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  const logPath = summary.artifactPaths?.logFile || bundle.logPath;
                                  openLogViewer(logPath, `${summary.mode.charAt(0).toUpperCase() + summary.mode.slice(1)} Log`);
                                }}
                              >
                                <FileText className="h-3 w-3" />
                                View log
                              </Button>
                            )}
                            {isTauriRuntime() && settings.showDetails && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={async () => {
                                  try {
                                    await openFolder(bundle.directory);
                                  } catch (err) {
                                    console.error('Failed to open folder:', err);
                                  }
                                }}
                              >
                                <FolderOpen className="h-3 w-3" />
                                Open folder
                              </Button>
                            )}
                            {!isTauriRuntime() && settings.showDetails && (
                              <Button
                                ref={artifactPathCopyFeedback.buttonRef}
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 relative"
                                onClick={async () => {
                                  await artifactPathCopyFeedback.triggerAsync(
                                    () => copyText(bundle.directory),
                                    'Copied',
                                    'Copy failed'
                                  );
                                }}
                              >
                                <Copy className="h-3 w-3" />
                                Copy path
                                <InlineFeedbackPopover feedback={artifactPathCopyFeedback.feedback} />
                              </Button>
                            )}
                            <Button
                              ref={artifactDiagnosticsCopyFeedback.buttonRef}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 relative"
                              onClick={async () => {
                                await artifactDiagnosticsCopyFeedback.triggerAsync(
                                  async () => {
                                    const content = await invoke<string>('read_text_file', { path: bundle.diagnosticsPath });
                                    await copyText(content);
                                  },
                                  'Copied',
                                  'Copy failed'
                                );
                              }}
                            >
                              <FileText className="h-3 w-3" />
                              Copy diagnostics
                              <InlineFeedbackPopover feedback={artifactDiagnosticsCopyFeedback.feedback} />
                            </Button>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Web mode notice */}
            {!isTauriRuntime() && (
              <div className="text-xs text-muted-foreground text-center py-3 px-4 rounded-md border border-dashed border-border">
                Run artifacts are only persisted in the desktop app
              </div>
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Settings"
              subtitle="Configure endstate engine and preferences"
            />
            
            {/* Active run banner */}
            {activeRunId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Run in progress</p>
                      <p className="text-xs text-muted-foreground">
                        {overviewRunningAction === 'capture' ? 'Capturing applications...' :
                         overviewRunningAction === 'setup' ? 'Setting up applications...' :
                         overviewRunningAction === 'check' ? 'Checking computer...' :
                         'Running...'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleNavigate('overview')}
                  >
                    View details
                  </Button>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Engine Configuration</CardTitle>
                <CardDescription>Choose how to run the endstate engine</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={settings.engineMode}
                  onValueChange={(value: 'path' | 'script') => updateSettings({ engineMode: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="path" id="engine-path" />
                    <label htmlFor="engine-path" className="text-sm cursor-pointer">
                      Use endstate from PATH
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="script" id="engine-script" />
                    <label htmlFor="engine-script" className="text-sm cursor-pointer">
                      Use endstate script path
                    </label>
                  </div>
                </RadioGroup>

                {settings.engineMode === 'script' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Script Path</label>
                    <Input
                      type="text"
                      value={settings.engineScriptPath}
                      onChange={(e) => updateSettings({ engineScriptPath: e.target.value })}
                      placeholder="C:\path\to\endstate.ps1"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Storage Directory (optional)</label>
                  <Input
                    type="text"
                    value={settings.customProfilesDirectory}
                    onChange={(e) => updateSettings({ customProfilesDirectory: e.target.value })}
                    placeholder="Leave empty to use default: Documents\Endstate\Setups"
                  />
                  <p className="text-xs text-muted-foreground">
                    By default, setups are stored in Documents\Endstate\Setups
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={loadInitialData}>
                    Reload Engine
                  </Button>
                  <Button variant="ghost" onClick={resetSettings}>
                    Reset to Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced</CardTitle>
                <CardDescription>Developer and troubleshooting options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Show details</label>
                    <p className="text-xs text-muted-foreground">
                      Show IDs, paths, and diagnostic information
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ showDetails: !settings.showDetails })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.showDetails ? 'bg-primary' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={settings.showDetails}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      settings.showDetails ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div>
                    <label className="text-sm font-medium">Reset selected profile</label>
                    <p className="text-xs text-muted-foreground">
                      {selectedProfile ? `Currently: ${selectedProfile}` : 'No profile selected'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={selectedProfile ? 'text-warning hover:text-warning' : ''}
                    onClick={() => {
                      clearSelectedProfile();
                      setSelectedProfile('');
                      setSelectedProfilePath('');
                      setSettings({ ...settings, selectedProfileName: null });
                      showToast('Selected profile cleared', 'success');
                    }}
                    disabled={!selectedProfile}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        );

      default:
        return null;
    }
  };

  // Build nav indicators from lifecycle state (only for pages that still exist in sidebar)
  const navIndicators: Partial<Record<'report', { type: 'success' | 'warning' | 'info' | 'activity'; tooltip?: string }>> = {};

  // Generate page title based on current page
  const getPageTitle = () => {
    switch (currentPage) {
      case 'landing': return '';
      case 'save': return '';
      case 'setup': return '';
      case 'overview': return '';
      case 'report': return 'Reports';
      case 'settings': return 'Settings';
      default: return '';
    }
  };

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        pageTitle={getPageTitle()}
        navIndicators={navIndicators}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={handleToggleSidebar}
        previousPage={previousPage}
        onBack={handleBack}
      >
        {renderPage()}
      </AppShell>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={handleNavigate}
      />

      {/* Folder Path Modal (web fallback) */}
      <Dialog open={showFolderPathModal} onOpenChange={setShowFolderPathModal}>
        <DialogContent data-testid="folder-path-modal" role="dialog">
          <DialogHeader>
            <DialogTitle>Profiles folder</DialogTitle>
            <DialogDescription>
              Your profiles are stored in the following location:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input 
                value={folderPathForModal} 
                readOnly 
                className="flex-1 font-mono text-sm select-all"
                data-testid="folder-path-input"
              />
              <Button
                ref={folderPathCopyFeedback.buttonRef}
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await folderPathCopyFeedback.triggerAsync(
                    () => copyText(folderPathForModal),
                    'Copied',
                    'Copy failed'
                  );
                }}
                aria-label="Copy path"
                className="relative"
              >
                <Copy className="h-4 w-4" />
                <InlineFeedbackPopover feedback={folderPathCopyFeedback.feedback} />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFolderPathModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Name Modal */}
      <Dialog open={showProfileNameModal} onOpenChange={(open) => {
        if (!open && !profileNameModalSuccess) {
          // Treat closing via X button same as Cancel - delete profile in save mode
          handleCancelProfileName();
        }
      }}>
        <DialogContent 
          data-testid="profile-name-modal" 
          role="dialog"
          onInteractOutside={(e) => {
            if (!profileNameModalSuccess) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!profileNameModalSuccess) {
              e.preventDefault();
              // Treat Escape same as Cancel - delete profile in save mode
              handleCancelProfileName();
            }
          }}
        >
          {profileNameModalSuccess ? (
            // Transitory success state - calm, intentional animation (2x slower)
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="py-12 flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-success" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-center space-y-1"
              >
                <p className="text-lg font-semibold text-success">Profile saved</p>
                <p className="text-sm text-muted-foreground">{savedProfileDisplayName}</p>
              </motion.div>
            </motion.div>
          ) : (
            // Normal input state
            <>
              <DialogHeader>
                <DialogTitle>{profileNameModalMode === 'rename' ? 'Rename profile' : 'Save profile'}</DialogTitle>
                <DialogDescription>
                  {profileNameModalMode === 'rename' 
                    ? 'Enter a new name for this profile. Leave empty to use filename.'
                    : 'Give this profile a name (optional). Leave empty to use filename.'}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3">
            {/* Capture summary in save mode */}
            {profileNameModalMode === 'save' && pendingCaptureDraft && settings.showDetails && (
              <div className="p-2 bg-muted/30 rounded text-xs">
                <span className="font-mono">{pendingCaptureDraft.capturedAppsCount} apps captured</span>
              </div>
            )}
            <Input 
              value={profileNameModalValue}
              onChange={(e) => setProfileNameModalValue(e.target.value)}
              placeholder="Profile name"
              className="w-full"
              data-testid="profile-name-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveProfileName();
                }
              }}
            />
            {profileNameModalMode === 'rename' && settings.showDetails && (
              <div>
                <button
                  onClick={() => setProfileNameModalMoreOptions(!profileNameModalMoreOptions)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {profileNameModalMoreOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {profileNameModalMoreOptions ? 'Hide' : 'Details'}
                </button>
                {profileNameModalMoreOptions && (() => {
                  const parts = profileNameModalPath.split(/[\\/]/);
                  const filename = parts[parts.length - 1] || '';
                  return (
                    <div className="mt-2 p-3 bg-muted/30 rounded-md space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Filename: </span>
                        <span className="font-mono">{filename}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Path: </span>
                        <span className="font-mono text-[10px] break-all">{profileNameModalPath}</span>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowProfileNameModal(false);
                            openRenameFileModal(profileNameModalPath, filename);
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          Rename file
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="secondary" onClick={handleCancelProfileName} data-testid="profile-name-cancel">
                  Cancel
                </Button>
                <Button onClick={handleSaveProfileName} data-testid="profile-name-save" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : (profileNameModalMode === 'rename' ? 'Rename' : 'Save profile')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Profile Confirmation Modal */}
      <Dialog open={showDeleteProfileModal} onOpenChange={setShowDeleteProfileModal}>
        <DialogContent data-testid="delete-profile-modal" role="alertdialog">
          <DialogHeader>
            <DialogTitle>Delete profile</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteProfileName}</strong>?
              {deleteProfilePath === selectedProfilePath && (
                <span className="block mt-2 text-warning">
                  You cannot delete the active profile. Please select a different profile first.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowDeleteProfileModal(false)}>
              Cancel
            </Button>
            {deleteProfilePath !== selectedProfilePath && (
              <Button variant="danger" onClick={handleDeleteProfile}>
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File Modal */}
      <RenameFileModal
        open={showRenameFileModal}
        onOpenChange={setShowRenameFileModal}
        currentFilename={renameFileCurrentName}
        currentDirectory={profilesDirectory}
        onConfirm={handleRenameFile}
      />

      {/* Log Viewer Modal */}
      <LogViewerModal
        open={showLogViewerModal}
        onOpenChange={setShowLogViewerModal}
        logContent={logViewerContent}
        title={logViewerTitle}
        isLoading={logViewerLoading}
        error={logViewerError}
      />
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
