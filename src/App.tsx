import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  EndstateEnvelope,
  EndstateCapabilitiesData,
  EndstateVerifyData,
  EndstateReportData,
  EndstateApplyData,
  EndstateCaptureData,
  EndstateRevertData,
  type RestoreItem,
  type RestoreSummary,
  type RestoreModuleRef,
} from './types';
import { AppSettings, loadSettings, saveSettings, loadSettingsWithProfileMigration, clearSelectedProfile } from './settings';
import { loadDraft, clearDraft } from './lib/draft-store';
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
import { IntentLanding, SaveFlow, SetupFlow } from './components/app/intent';
import { getProfilesDirectory, ensureDirectory, isTauriRuntime, openFolder, invoke } from './lib/tauri-bridge';
import { runEndstateOnce, getErrorMessage, buildEngineCommand } from './lib/engine-exec';
import { saveProfileMetadata, deleteProfileFiles } from './lib/profile-metadata';
import { validateProfileFilename, getExtension, type ValidExtension } from './lib/filename-validation';
import { loadRunSummaries, createRunBundle, generateRunId, writeSummary, writeLog, generateDiagnosticsText, writeDiagnostics, type RunBundle, type RunSummary } from './lib/run-artifacts';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/layout/command-palette';
import { PageHeader } from './components/app/page-header';
import { RenameFileModal } from './components/app/rename-file-modal';
import { LogViewerModal } from './components/app/log-viewer-modal';
import { ToastProvider, useToast } from './components/ui/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { Loader2, Copy, ChevronDown, ChevronRight, ChevronUp, FolderOpen, FileText, CheckCircle2, HardDrive, Download } from 'lucide-react';
import { cn } from './lib/utils';
import { useMicroFeedback } from './lib/micro-feedback';
import { InlineFeedbackPopover } from './components/ui/inline-feedback-popover';
import { copyText } from './lib/clipboard';
import { LicenseGate, useLicenseGate } from './components/app/LicenseGate';
import { deactivateLicense } from './lib/license';

type AppStatus = 'loading' | 'ready' | 'error';
type PageType = 'landing' | 'save' | 'setup' | 'report' | 'settings';

interface AppState {
  status: AppStatus;
  errorMessage: string | null;
  errorStderr: string | null;
  errorCommand: string | null;
  capabilities: EndstateEnvelope<EndstateCapabilitiesData> | null;
  report: EndstateEnvelope<EndstateReportData> | null;
  verify: EndstateEnvelope<EndstateVerifyData> | null;
}

/**
 * Read bundle metadata.json from a profile's parent directory.
 * Returns config module info if the profile is inside a bundle (subdirectory with metadata.json).
 */
async function readBundleMetadata(profilePath: string): Promise<{
  configModulesIncluded?: RestoreModuleRef[];
} | null> {
  try {
    const dir = profilePath.replace(/[\\/][^\\/]+$/, '');
    const metadataPath = `${dir}\\metadata.json`;
    const exists = await invoke<boolean>('check_file_exists', { path: metadataPath });
    if (!exists) return null;
    const content = await invoke<string>('read_text_file', { path: metadataPath });
    const metadata = JSON.parse(content);
    const configModulesIncluded: RestoreModuleRef[] | undefined = metadata.configModulesIncluded;
    if (!configModulesIncluded?.length) return null;
    return { configModulesIncluded };
  } catch {
    return null;
  }
}

function AppContent() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [currentPage, setCurrentPage] = useState<PageType>('landing');
  const [previousPage, setPreviousPage] = useState<PageType | null>(null);
  const [activeFlowPage, setActiveFlowPage] = useState<'save' | 'setup' | null>(null);
  const [flowHasWork, setFlowHasWork] = useState<Record<'save' | 'setup', boolean>>({ save: false, setup: false });
  const [saveFlowResetKey, setSaveFlowResetKey] = useState(0);
  const [setupFlowResetKey, setSetupFlowResetKey] = useState(0);
  // Navigation handler
  const handleNavigate = async (page: PageType) => {
    // Remember flow page for direct back-navigation from settings/reports
    if ((currentPage === 'save' || currentPage === 'setup') && page !== 'landing' && page !== 'save' && page !== 'setup') {
      setPreviousPage(currentPage);
    }
    if (page === 'save' || page === 'setup') {
      setActiveFlowPage(page);
    }
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
  // Refs for immediate access in async callbacks (avoid stale closures)
  const selectedProfileRef = useRef(selectedProfile);
  const selectedProfilePathRef = useRef(selectedProfilePath);
  // Helper: update profile state + refs atomically
  const setProfileSelection = (name: string, path: string) => {
    selectedProfileRef.current = name;
    selectedProfilePathRef.current = path;
    setSelectedProfile(name);
    setSelectedProfilePath(path);
  };
  
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
    configModuleMap?: Record<string, string>;
    restoreItems?: RestoreItem[];
    restoreSummary?: RestoreSummary;
    restoreJournalFile?: string;
    restoreModulesAvailable?: RestoreModuleRef[];
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
  const [, setActionStatusByAction] = useState<Record<string, OverviewActionStatus>>({
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
  const [liveAppEvents, setLiveAppEvents] = useState<AppEvent[]>([]);
  const [, setLiveCounters] = useState<LiveCounters>({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });

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
  const [, setLastSavedProfileSummary] = useState<{
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
  
  // Undo settings — navigates to setup flow and triggers inline undo
  const [setupPendingUndo, setSetupPendingUndo] = useState(false);

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

  // Handle file drops from the Setup flow drop zone (ADR-001)
  const handleFileDrop = async (files: File[]) => {
    // Resolve profiles directory on-demand if startup init hasn't completed yet
    let dir = profilesDirectory;
    if (!dir) {
      dir = (await loadProfilesDirectory()) || '';
      if (dir) setProfilesDirectory(dir);
    }
    if (!dir) {
      showToast('Profiles directory not available', 'error');
      return;
    }

    await ensureDirectory(dir);

    for (const file of files) {
      const fileName = file.name.toLowerCase();
      try {
        if (fileName.endsWith('.zip')) {
          // Zip files: encode as base64, send to Rust for extraction
          const arrayBuf = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          // Convert to base64
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);
          await invoke<string>('import_zip_from_base64', {
            data: base64Data,
            fileName: file.name,
            profilesDir: dir,
          });
          showToast(`Imported ${file.name}`, 'success');
        } else if (fileName.endsWith('.jsonc') || fileName.endsWith('.json') || fileName.endsWith('.json5')) {
          // Manifest files: read text and write to profiles directory
          const text = await file.text();
          const destPath = `${dir}\\${file.name}`;
          await invoke('write_text_file', { path: destPath, content: text });
          showToast(`Imported ${file.name}`, 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Failed to import ${file.name}: ${msg}`, 'error');
      }
    }

    // Refresh profiles after import
    await refreshProfiles();
  };

  // Import profiles by file path (Tauri mode: Rust handles file I/O directly)
  const handleFilePathImport = async (paths: string[]) => {
    // Resolve profiles directory on-demand if startup init hasn't completed yet
    let dir = profilesDirectory;
    if (!dir) {
      dir = (await loadProfilesDirectory()) || '';
      if (dir) setProfilesDirectory(dir);
    }
    if (!dir) {
      showToast('Profiles directory not available', 'error');
      return;
    }

    await ensureDirectory(dir);

    for (const filePath of paths) {
      const fileName = filePath.split(/[/\\]/).pop() || '';
      try {
        if (fileName.toLowerCase().endsWith('.zip')) {
          await invoke('extract_zip_profile', { zipPath: filePath, profilesDir: dir });
        } else {
          await invoke('import_profile', { sourcePath: filePath, profilesDir: dir });
        }
        showToast(`Imported ${fileName}`, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Failed to import ${fileName}: ${msg}`, 'error');
      }
    }

    await refreshProfiles();
  };

  // Browse for profile files using native dialog (Tauri mode only)
  const handleBrowseFiles = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Profile files',
          extensions: ['zip', 'json', 'jsonc', 'json5'],
        }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await handleFilePathImport(paths);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to browse files: ${msg}`, 'error');
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

  // Tauri drag-drop: listen for native file drops and import to profiles.
  // Use refs to avoid stale closures and ensure proper async cleanup.
  const dragDropUnlistenRef = useRef<(() => void) | undefined>();
  const handleFilePathImportRef = useRef(handleFilePathImport);
  handleFilePathImportRef.current = handleFilePathImport;

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;

    (async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        if (cancelled) return;
        const webview = getCurrentWebviewWindow();
        const unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths as string[];
            const accepted = paths.filter((p) => {
              const name = p.toLowerCase();
              return name.endsWith('.zip') || name.endsWith('.json') || name.endsWith('.jsonc') || name.endsWith('.json5');
            });
            if (accepted.length > 0) {
              handleFilePathImportRef.current(accepted);
            }
          }
        });
        if (cancelled) {
          unlisten();
        } else {
          dragDropUnlistenRef.current = unlisten;
        }
      } catch {
        // Not in Tauri runtime or API unavailable
      }
    })();

    return () => {
      cancelled = true;
      dragDropUnlistenRef.current?.();
      dragDropUnlistenRef.current = undefined;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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


  const handleDeleteProfile = async () => {
    if (!deleteProfilePath) return;

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

      // Dev-mode: log engine version info for staleness detection
      if (import.meta.env.DEV) {
        const capData = capResult.envelope.data;
        if (capData.gitCommit) {
          console.log(
            `[ENGINE] gitCommit=${capData.gitCommit} dirty=${capData.gitDirty ?? 'unknown'} bootstrapped=${capData.bootstrapTimestamp ?? 'unknown'}`
          );
        } else {
          console.warn(
            '[ENGINE WARNING] No gitCommit in capabilities — likely running stale bootstrapped copy. Consider using script mode or re-bootstrapping.'
          );
        }
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
      const fallbackCmd = await buildEngineCommand(settings, ['capabilities', '--json']);
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
    const filename = `capture_${timestamp}.zip`;
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
      ['--WithConfig', '--out', outputPath],
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
              detail: `${uiStatus.longLabel}: ${ndjsonEvent.name || ndjsonEvent.id}`
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
    
    // Enrich appsIncluded with display names from streaming events.
    // The envelope often omits `name` but the NDJSON item events carry it.
    const streamingNameMap = new Map<string, string>();
    for (const ev of overviewCaptureEvents) {
      if (ev.name && ev.app) streamingNameMap.set(ev.app, ev.name);
    }
    const enrichedAppsIncluded = appsIncluded.map(a => ({
      ...a,
      name: a.name || streamingNameMap.get(a.id),
    }));

    // Return structured result with draft text and canonical app list for modal
    // INVARIANT: count, apps, and appsIncluded ALL derive from envelope.data.appsIncluded
    return { count: capturedCount, draftText, apps: appsList, appsIncluded: enrichedAppsIncluded, envelopeData };
  };

  const handlePreviewFromOverview = async () => {
    // Use refs for immediate access (state may not have settled in async callbacks)
    const profileName = selectedProfileRef.current || selectedProfile;
    const profilePath = selectedProfilePathRef.current || selectedProfilePath;
    if (!profileName) {
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
      ['--profile', profilePath, '--dry-run'],
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
              detail: `${uiStatus.longLabel}: ${ndjsonEvent.name || ndjsonEvent.id}`
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

    // Envelope counts are source of truth; fall back to actions array.
    // No streaming counter fallback — those are unreliable (inflated by plan/verify phases).
    const envelopeData = applyResult.envelope?.data;
    const previewActions = envelopeData?.actions ?? [];
    let installed: number, alreadyPresent: number;
    if (envelopeData?.counts) {
      installed = envelopeData.counts.installed;
      alreadyPresent = envelopeData.counts.alreadyInstalled;
    } else if (previewActions.length > 0) {
      installed = previewActions.filter(a => a.status === 'to_install' || a.status === 'installed').length;
      alreadyPresent = previewActions.filter(a => a.status === 'present').length;
    } else {
      console.error('[PREVIEW] Envelope missing both counts and actions — cannot derive reliable totals. Raw envelope:', applyResult.envelope);
      installed = 0;
      alreadyPresent = 0;
    }

    // Persist run artifacts (logs, diagnostics, summary)
    if (runBundle) {
      const durationMs = Date.now() - runStartTime;
      const logContent = applyResult.stdout + '\n\n=== STDERR ===\n\n' + applyResult.stderr;
      await writeLog(runBundle, logContent);

      const diagnostics = generateDiagnosticsText({
        command: 'apply',
        mode: 'preview',
        profileName: profileName,
        profilePath: profilePath,
        counts: { installed, alreadyPresent },
      });
      await writeDiagnostics(runBundle, diagnostics);
      
      await writeSummary(runBundle, {
        runId,
        command: 'apply',
        mode: 'preview',
        timestamp: new Date().toISOString(),
        profileName: profileName,
        profilePath: profilePath,
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
      profile: profileName,
      profilePath: profilePath,
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

    let restoreModulesAvailable = envelopeData?.restoreModulesAvailable;
    const configModuleMap = envelopeData?.configModuleMap;
    if (!restoreModulesAvailable) {
      const bundleMeta = await readBundleMetadata(profilePath);
      if (bundleMeta?.configModulesIncluded) {
        restoreModulesAvailable = bundleMeta.configModulesIncluded;
      }
    }

    return {
      installed,
      alreadyPresent,
      profile: profileName,
      appEvents: collectedEvents,
      restoreModulesAvailable,
      configModuleMap,
    };
  };


  const handleApplyFromOverview = async (restoreOptions?: { restoreIntent?: import('./types').RestoreIntent; selectedModules?: string[] }) => {
    // Use refs for immediate access (state may not have settled in async callbacks)
    const profileName = selectedProfileRef.current || selectedProfile;
    const profilePath = selectedProfilePathRef.current || selectedProfilePath;
    if (!profileName) {
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
    const applyArgs = ['--profile', profilePath];
    if (restoreOptions?.restoreIntent === 'apps-and-settings' && restoreOptions.selectedModules && restoreOptions.selectedModules.length > 0) {
      applyArgs.push('--enable-restore');
      applyArgs.push('--restore-filter', restoreOptions.selectedModules.join(','));
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
              // New item — also count if it arrives directly in a final state
              // (CLI may skip non-final events for fast-resolved items)
              const isFinal = ['installed', 'present', 'skipped', 'failed'].includes(appEvent.statusKey || '');
              if (isFinal) {
                if (appEvent.statusKey === 'installed') counters.installed++;
                else if (appEvent.statusKey === 'present') counters.alreadyPresent++;
                else if (appEvent.statusKey === 'skipped') counters.skipped++;
                else if (appEvent.statusKey === 'failed') counters.failed++;
              }
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
                message: `${uiStatus.longLabel}: ${ndjsonEvent.name || ndjsonEvent.id}`,
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
                message: `${uiStatus.longLabel}: ${ndjsonEvent.name || ndjsonEvent.id}`,
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
    const envelopeData = applyResult.envelope?.data;
    const envelopeItems = envelopeData?.items ?? [];

    // CRITICAL: Reconcile live activity with final envelope
    // This ensures "Working..." entries are updated to their final status (Failed, Installed, etc.)
    const reconciledEvents = reconcileLiveActivity(appEventList, envelopeItems);
    // Bounded buffer: keep up to 2000 events for scrollback
    setLiveAppEvents(reconciledEvents.length > 2000 ? reconciledEvents.slice(-2000) : reconciledEvents);

    // Envelope counts are source of truth; fall back to actions array.
    // No streaming counter fallback — those are unreliable (inflated by plan/verify phases).
    const envelopeActions = envelopeData?.actions ?? [];
    let installed: number, alreadyPresent: number, failed: number, skipped: number;
    if (envelopeData?.counts) {
      installed = envelopeData.counts.installed;
      alreadyPresent = envelopeData.counts.alreadyInstalled;
      failed = envelopeData.counts.failed;
      skipped = envelopeData.counts.skippedFiltered;
    } else if (envelopeActions.length > 0) {
      installed = envelopeActions.filter(a => a.status === 'installed').length;
      alreadyPresent = envelopeActions.filter(a => a.status === 'present').length;
      failed = envelopeActions.filter(a => a.status === 'failed').length;
      skipped = envelopeActions.filter(a => a.status === 'skipped').length;
    } else {
      console.error('[APPLY] Envelope missing both counts and actions — cannot derive reliable totals. Raw envelope:', applyResult.envelope);
      installed = 0;
      alreadyPresent = 0;
      failed = 0;
      skipped = 0;
    }

    // Restore summary: envelope is source of truth, fall back to NDJSON counters for older CLI
    const restoreSummary: RestoreSummary | undefined = envelopeData?.restoreSummary ?? (
      (counters.configsRestored + counters.configsSkipped + counters.configsFailed > 0)
        ? { total: counters.configsRestored + counters.configsSkipped + counters.configsFailed, restored: counters.configsRestored, skipped: counters.configsSkipped, failed: counters.configsFailed, backupLocation: null }
        : undefined
    );
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
        profileName: profileName,
        profilePath: profilePath,
        counts: { installed, alreadyPresent, skipped, failed },
      });
      await writeDiagnostics(runBundle, diagnostics);

      await writeSummary(runBundle, {
        runId,
        command: 'apply',
        mode: 'apply',
        timestamp: new Date().toISOString(),
        profileName: profileName,
        profilePath: profilePath,
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
      profile: profileName,
      profilePath: profilePath,
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
    
    const configModuleMapResult = envelopeData?.configModuleMap;
    let restoreModulesAvailableResult = envelopeData?.restoreModulesAvailable;
    if (!restoreModulesAvailableResult) {
      const bundleMeta = await readBundleMetadata(profilePath);
      if (bundleMeta?.configModulesIncluded) {
        restoreModulesAvailableResult = bundleMeta.configModulesIncluded;
      }
    }

    return {
      installed, alreadyPresent, failed, skipped,
      profile: profileName,
      appEvents: reconciledEvents,
      configModuleMap: configModuleMapResult,
      restoreItems: envelopeData?.restoreItems,
      restoreSummary,
      restoreJournalFile: envelopeData?.restoreJournalFile,
      restoreModulesAvailable: restoreModulesAvailableResult,
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

  // Always-mounted flow pages — hidden via CSS when not active to preserve internal state
  const renderPersistentFlows = () => {
    const errorBanner = renderErrorBanner();
    return (
      <>
        <div style={{ display: currentPage === 'save' ? undefined : 'none' }}>
          <div className="space-y-6">
            {errorBanner}
            <SaveFlow
              onBack={() => { setActiveFlowPage(null); setFlowHasWork(prev => ({ ...prev, save: false })); setSaveFlowResetKey(k => k + 1); setCurrentPage('landing'); }}
              resetKey={saveFlowResetKey}
              onFlowReset={() => setFlowHasWork(prev => ({ ...prev, save: false }))}
              engineConnected={state.status !== 'error'}
              isRunning={isRunning}
              captureProgress={actionProgressByAction['capture'] ?? null}
              liveAppEvents={liveAppEvents}
              onStartCapture={async () => {
                setIsRunning(true);
                setLiveAppEvents([]);
                setOverviewRunningAction('capture');
                setOverviewActionStatus('capture', 'running');
                setOverviewActionProgress('capture', { message: 'Scanning installed applications...' });
                try {
                  const result = await handleCaptureFromOverview();
                  setOverviewActionStatus('capture', 'success');
                  setFlowHasWork(prev => ({ ...prev, save: true }));
                  return {
                    count: result.count,
                    draftText: result.draftText,
                    apps: (result.appsIncluded ?? []).map(a => ({ id: a.id, name: a.name })),
                    outputPath: result.envelopeData?.outputPath,
                    outputFormat: result.envelopeData?.outputFormat,
                    configsIncluded: result.envelopeData?.configsIncluded,
                    configModules: result.envelopeData?.configModules,
                  };
                } finally {
                  setIsRunning(false);
                  setOverviewRunningAction(null);
                }
              }}
              onSaveToFile={async (captureResult) => {
                const isZip = captureResult.outputFormat === 'zip' && captureResult.outputPath;
                const ext = isZip ? 'zip' : 'jsonc';
                const defaultName = `endstate-capture_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
                if (isTauriRuntime()) {
                  // Native Tauri: use OS save dialog
                  const { save } = await import('@tauri-apps/plugin-dialog');
                  const savePath = await save({
                    defaultPath: defaultName,
                    filters: isZip
                      ? [{ name: 'Endstate Bundle', extensions: ['zip'] }]
                      : [{ name: 'Endstate Profile', extensions: ['jsonc'] }],
                    title: 'Save Capture File',
                  });
                  if (!savePath) return false;
                  if (isZip) {
                    await invoke('copy_file', { sourcePath: captureResult.outputPath, destPath: savePath });
                  } else {
                    await invoke('write_text_file', { path: savePath, content: captureResult.draftText });
                  }
                } else {
                  // Web/Tidewave: browser download
                  let blob: Blob;
                  let downloadName = defaultName;
                  if (isZip) {
                    try {
                      const base64 = await invoke<string>('read_file_base64', { path: captureResult.outputPath });
                      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                      blob = new Blob([bytes], { type: 'application/zip' });
                    } catch {
                      // read_file_base64 unavailable — fall back to jsonc text
                      blob = new Blob([captureResult.draftText], { type: 'application/json' });
                      downloadName = defaultName.replace('.zip', '.jsonc');
                    }
                  } else {
                    blob = new Blob([captureResult.draftText], { type: 'application/json' });
                  }
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = downloadName;
                  a.click();
                  URL.revokeObjectURL(url);
                }
                showToast('File saved', 'success');
                return true;
              }}
            />
          </div>
        </div>
        <div style={{ display: currentPage === 'setup' ? undefined : 'none' }}>
          <div className="space-y-6">
            {errorBanner}
            <SetupFlow
              profiles={profiles}
              onBack={() => { setActiveFlowPage(null); setFlowHasWork(prev => ({ ...prev, setup: false })); setSetupFlowResetKey(k => k + 1); setCurrentPage('landing'); }}
              resetKey={setupFlowResetKey}
              onFlowReset={() => setFlowHasWork(prev => ({ ...prev, setup: false }))}
              onProfileSelect={(profile) => {
                setProfileSelection(profile.name, profile.path);
                updateSettings({ selectedProfileName: profile.name });
              }}
              onOpenProfilesFolder={handleOpenProfilesFolder}
              onRefreshProfiles={refreshProfiles}
              onFileDrop={handleFileDrop}
              onBrowse={isTauriRuntime() ? handleBrowseFiles : undefined}
              onDeleteProfile={(path: string, displayName: string) => {
                setDeleteProfilePath(path);
                setDeleteProfileName(displayName);
                setShowDeleteProfileModal(true);
              }}
              isRunning={isRunning}
              setupProgress={actionProgressByAction['setup'] ?? null}
              liveAppEvents={liveAppEvents}
              onPreview={async (profile) => {
                setProfileSelection(profile.name, profile.path);
                updateSettings({ selectedProfileName: profile.name });
                setIsRunning(true);
                setLiveAppEvents([]);
                setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
                setOverviewRunningAction('setup');
                setOverviewActionStatus('setup', 'running');
                setOverviewActionProgress('setup', { message: 'Evaluating changes' });
                try {
                  const result = await handlePreviewFromOverview();
                  setOverviewActionStatus('setup', 'success');
                  setFlowHasWork(prev => ({ ...prev, setup: true }));
                  return result;
                } finally {
                  setIsRunning(false);
                  setOverviewRunningAction(null);
                }
              }}
              onApply={async (profile, restoreOptions) => {
                setProfileSelection(profile.name, profile.path);
                updateSettings({ selectedProfileName: profile.name });
                setIsRunning(true);
                setLiveAppEvents([]);
                setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
                setOverviewRunningAction('setup');
                setOverviewActionStatus('setup', 'running');
                setOverviewActionProgress('setup', { message: 'Installing applications...' });
                try {
                  const result = await handleApplyFromOverview(restoreOptions);
                  setOverviewActionStatus('setup', result.failed > 0 ? 'error' : 'success');
                  setFlowHasWork(prev => ({ ...prev, setup: true }));
                  return {
                    ...result,
                    configsRestored: result.restoreSummary?.restored,
                    configsSkipped: result.restoreSummary?.skipped,
                    configsFailed: result.restoreSummary?.failed,
                  };
                } finally {
                  setIsRunning(false);
                  setOverviewRunningAction(null);
                }
              }}
              onUndoDryRun={() => runEndstateOnce<EndstateEnvelope<EndstateRevertData>>(settings, 'revert', ['--dry-run'])}
              onUndoExecute={() => runEndstateOnce<EndstateEnvelope<EndstateRevertData>>(settings, 'revert', [])}
              onUndoComplete={(data) => {
                showToast(
                  `Undid ${data.revertCount} ${data.revertCount === 1 ? 'setting' : 'settings'} successfully`,
                  'success',
                );
              }}
              pendingUndo={setupPendingUndo}
              onPendingUndoConsumed={() => setSetupPendingUndo(false)}
            />
          </div>
        </div>
      </>
    );
  };

  const renderPage = () => {
    // Show error banner at top of any page when in error state
    const errorBanner = renderErrorBanner();

    switch (currentPage) {
      case 'landing':
        return (
          <div>
            {errorBanner}
            <IntentLanding
              onSelectSave={() => { setActiveFlowPage('save'); setCurrentPage('save'); }}
              onSelectSetup={() => { setActiveFlowPage('setup'); setCurrentPage('setup'); }}
              engineConnected={state.status !== 'error'}
              saveHasSession={flowHasWork.save}
              setupHasSession={flowHasWork.setup}
            />
          </div>
        );

      // Save and Setup are always mounted via renderPersistentFlows — skip here
      case 'save':
      case 'setup':
        return null;

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
            {isRunning && (
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
                    onClick={() => handleNavigate(overviewRunningAction === 'capture' ? 'save' : 'setup')}
                  >
                    View details
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Resumable flow session banner */}
            {!isRunning && activeFlowPage && flowHasWork[activeFlowPage] && (
              <Card className={cn(
                'border-l-2',
                activeFlowPage === 'save' ? 'border-l-blue-500/50 bg-blue-500/5' : 'border-l-green-500/50 bg-green-500/5'
              )}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {activeFlowPage === 'save'
                      ? <HardDrive className="h-4 w-4 text-blue-500" />
                      : <Download className="h-4 w-4 text-green-500" />
                    }
                    <p className="text-sm font-medium">
                      {activeFlowPage === 'save' ? 'You have an unsaved capture' : 'You have setup results to review'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleNavigate(activeFlowPage)}
                  >
                    Resume
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
                            {isRunning && overviewRunningAction === run.mode ? (
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
            {isRunning && (
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
                    onClick={() => handleNavigate(overviewRunningAction === 'capture' ? 'save' : 'setup')}
                  >
                    View details
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Resumable flow session banner */}
            {!isRunning && activeFlowPage && flowHasWork[activeFlowPage] && (
              <Card className={cn(
                'border-l-2',
                activeFlowPage === 'save' ? 'border-l-blue-500/50 bg-blue-500/5' : 'border-l-green-500/50 bg-green-500/5'
              )}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {activeFlowPage === 'save'
                      ? <HardDrive className="h-4 w-4 text-blue-500" />
                      : <Download className="h-4 w-4 text-green-500" />
                    }
                    <p className="text-sm font-medium">
                      {activeFlowPage === 'save' ? 'You have an unsaved capture' : 'You have setup results to review'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleNavigate(activeFlowPage)}
                  >
                    Resume
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
                  onValueChange={(value: 'bundled' | 'path' | 'script') => updateSettings({ engineMode: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bundled" id="engine-bundled" />
                    <label htmlFor="engine-bundled" className="text-sm cursor-pointer">
                      Bundled (recommended)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="path" id="engine-path" />
                    <label htmlFor="engine-path" className="text-sm cursor-pointer">
                      System PATH (development)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="script" id="engine-script" />
                    <label htmlFor="engine-script" className="text-sm cursor-pointer">
                      Script (legacy)
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

            <LicenseSettingsSection />

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
        {renderPersistentFlows()}
        {renderPage()}
      </AppShell>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={handleNavigate}
        onUndoSettings={() => {
          setSetupPendingUndo(true);
          setCurrentPage('setup');
        }}
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
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowDeleteProfileModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteProfile}>
              Delete
            </Button>
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

function LicenseSettingsSection() {
  const license = useLicenseGate();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  if (!license) return null;

  const { status, onDeactivated } = license;
  const maskedKey = status.key
    ? `${'*'.repeat(Math.max(0, status.key.length - 4))}${status.key.slice(-4)}`
    : 'Unknown';
  const activatedDate = status.activatedAt
    ? new Date(status.activatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await deactivateLicense();
      setShowDeactivateDialog(false);
      onDeactivated();
    } catch {
      // Keep dialog open on error so user can retry
      setDeactivating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>License</CardTitle>
          <CardDescription>Manage your Endstate license</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">License key</span>
              <span className="font-mono">{maskedKey}</span>
            </div>
            {activatedDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activated</span>
                <span>{activatedDate}</span>
              </div>
            )}
            {status.machineName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Machine</span>
                <span>{status.machineName}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeactivateDialog(true)}
            >
              Deactivate this machine
            </Button>
            <a
              href="https://app.lemonsqueezy.com/my-orders"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                Manage license
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Deactivate license</DialogTitle>
            <DialogDescription>
              This will deactivate your license on this machine. You can reactivate later using the same key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowDeactivateDialog(false)} disabled={deactivating}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <LicenseGate>
        <AppContent />
      </LicenseGate>
    </ToastProvider>
  );
}

export default App;
