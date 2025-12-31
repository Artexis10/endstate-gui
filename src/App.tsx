import { useEffect, useState, useRef } from 'react';
import {
  EndstateEnvelope,
  EndstateCapabilitiesData,
  EndstateVerifyData,
  EndstateReportData,
  EndstateApplyData,
  EndstateCaptureData,
  EndstateApplyResultData,
} from './types';
import { AppSettings, loadSettings, saveSettings } from './settings';
import { discoverProfiles, DiscoveredProfile } from './file-discovery';
import { StreamEvent } from './streaming-runner';
import { runEngineStreaming } from './lib/engine';
import { LogBuffer } from './log-buffer';
import { StreamingLineBuffer, reconcileLiveActivity, itemEventToAppEvent, getPhaseAwareStatusForEvent, type AppEvent, type UiPhase } from './lib/apply-utils';
import { isItemEvent, isArtifactEvent, isPhaseEvent, type EnginePhase } from './lib/streaming-events';
import { loadLastRunForCommand, migrateLegacyLastRun, type LastRunData } from './lib/last-run';
import { loadLifecycleState, recordLifecycleEvent, formatRelativeTime, type LifecycleState, type LifecycleEvent } from './lib/lifecycle-state';
import { loadSidebarVisible, saveSidebarVisible } from './lib/ui-mode';
import { OverviewScreen } from './components/app/overview-screen';
import { getProfilesDirectory, ensureDirectory, isTauriRuntime, openFolder, invoke } from './lib/tauri-bridge';
import { runEndstateOnce, getErrorMessage } from './lib/engine-exec';
import { saveProfileMetadata, deleteProfileFiles } from './lib/profile-metadata';
import { validateProfileFilename, getExtension, type ValidExtension } from './lib/filename-validation';
import { loadRunSummaries, createRunBundle, generateRunId, writeSummary, writeLog, generateDiagnosticsText, writeDiagnostics, type RunBundle, type RunSummary } from './lib/run-artifacts';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/layout/command-palette';
import { PageHeader } from './components/app/page-header';
import { RenameFileModal } from './components/app/rename-file-modal';
import { ToastProvider, useToast } from './components/ui/toast';
import { formatCount } from './lib/pluralize';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { Loader2, Copy, ChevronDown, ChevronRight, ChevronUp, FolderOpen, FileText } from 'lucide-react';
import { useMicroFeedback } from './lib/micro-feedback';
import { InlineFeedbackPopover } from './components/ui/inline-feedback-popover';
import { copyText } from './lib/clipboard';

type AppStatus = 'loading' | 'ready' | 'error';
type PageType = 'overview' | 'report' | 'settings';

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
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
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
    };
    profile?: string;
    timestamp?: string;
    wasPreview?: boolean; // Track if this was a preview (for showing Apply button)
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
  }
  
  const [overviewRunningAction, setOverviewRunningAction] = useState<OverviewActionType>(null);
  const [overviewActionStatus, setOverviewActionStatus] = useState<OverviewActionStatus>('idle');
  const [overviewActionProgress, setOverviewActionProgress] = useState<{ message: string; detail?: string; phase?: UiPhase } | null>(null);
  const [overviewActionResult, setOverviewActionResult] = useState<OverviewActionResult | null>(null);
  const [liveAppEvents, setLiveAppEvents] = useState<AppEvent[]>([]);
  const [liveCounters, setLiveCounters] = useState<LiveCounters>({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
  const isRunningRef = useRef(false); // Robust guard against double-run
  const activeRunIdRef = useRef<string | null>(null); // Track active run ID for double-run prevention
  const [activeRunId, setActiveRunId] = useState<string | null>(null); // App-level active run ID for UI awareness
  const [showFolderPathModal, setShowFolderPathModal] = useState(false);
  const [folderPathForModal, setFolderPathForModal] = useState('');
  
  // Profile naming modal state
  const [showProfileNameModal, setShowProfileNameModal] = useState(false);
  const [profileNameModalPath, setProfileNameModalPath] = useState('');
  const [profileNameModalValue, setProfileNameModalValue] = useState('');
  const [profileNameModalMode, setProfileNameModalMode] = useState<'save' | 'rename'>('save');
  const [profileNameModalMoreOptions, setProfileNameModalMoreOptions] = useState(false);
  
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
  
  // Micro-feedback hooks for copy actions
  const diagnosticsCopyFeedback = useMicroFeedback();
  const folderPathCopyFeedback = useMicroFeedback();
  const artifactPathCopyFeedback = useMicroFeedback();
  const artifactDiagnosticsCopyFeedback = useMicroFeedback();
  
  // Dismiss result - only collapse UI, preserve summary for Overview display
  const dismissOverviewResult = () => {
    // Only reset transient UI state (expanded/collapsed, filters)
    // Keep overviewActionResult so the summary remains visible on Overview
    setOverviewActionProgress(null);
    setLiveAppEvents([]);
    setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
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

  const openProfileNameModal = (profilePath: string, existingName: string = '', mode: 'save' | 'rename' = 'save') => {
    setProfileNameModalPath(profilePath);
    setProfileNameModalValue(existingName);
    setProfileNameModalMode(mode);
    setProfileNameModalMoreOptions(false);
    setShowProfileNameModal(true);
  };

  const handleSaveProfileName = async () => {
    if (profileNameModalValue.trim()) {
      try {
        await saveProfileMetadata(profileNameModalPath, { displayName: profileNameModalValue.trim() });
        await refreshProfiles();
      } catch (err) {
        console.error('Failed to save profile name:', err);
      }
    }
    setShowProfileNameModal(false);
    setProfileNameModalPath('');
    setProfileNameModalValue('');
    setProfileNameModalMoreOptions(false);
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
            updateSettings({ 
              lastSelectedProfile: firstProfile.name,
              lastSelectedProfilePath: firstProfile.path 
            });
            // Show toast notification for fallback selection
            showToast(`Selected profile no longer exists—switched to "${firstProfile.displayName || firstProfile.name}".`, 'info');
          } else {
            // No profiles remain
            setSelectedProfile('');
            setSelectedProfilePath('');
            updateSettings({ lastSelectedProfile: '', lastSelectedProfilePath: '' });
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
    updateSettings({ 
      lastSelectedProfile: profile.name, 
      lastSelectedProfilePath: profile.path 
    });
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
        updateSettings({ lastSelectedProfile: newName, lastSelectedProfilePath: newPath });
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

  const promptForProfileName = async (profilePath: string): Promise<void> => {
    // Generate a default name based on timestamp
    const now = new Date();
    const defaultName = `Profile ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    openProfileNameModal(profilePath, defaultName, 'save');
  };

  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);
    setSelectedProfile(loadedSettings.lastSelectedProfile);
    setSelectedProfilePath(loadedSettings.lastSelectedProfilePath || '');
    
    // Migrate legacy last run and load per-command last runs
    migrateLegacyLastRun();
    setLastRunCapture(loadLastRunForCommand('capture'));
    setLastRunApply(loadLastRunForCommand('apply'));
    setLastRunVerify(loadLastRunForCommand('verify'));
    
    refreshProfiles();
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
      setState({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to initialize engine',
        errorStderr: null,
        errorCommand: 'endstate capabilities --json',
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

    const dir = await loadProfilesDirectory();
    if (!dir) {
      throw new Error('Failed to determine profiles directory');
    }
    
    await ensureDirectory(dir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const filename = `setup_${timestamp}.jsonc`;
    const outputPath = `${dir}\\${filename}`;

    // Create run artifact bundle
    const runId = generateRunId();
    const runBundle = await createRunBundle(dir, runId);
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
            setLiveAppEvents([...overviewCaptureEvents]);
            const uiStatus = getPhaseAwareStatusForEvent({ 
              statusKey: appEvent.statusKey || 'skipped', 
              phase: 'capture', 
              reason: appEvent.reason 
            });
            setOverviewActionProgress({ 
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
            setLiveAppEvents([...overviewCaptureEvents]);
          }
        },
      }
    );

    logBufferRef.current?.flush();
    setIsRunning(false);

    const isSuccess = captureResult.envelope?.success ?? (captureResult.exitCode === 0);
    
    if (!isSuccess) {
      throw new Error(captureResult.envelope?.error?.message || 'Capture failed');
    }

    // Get count from envelope data (preferred) or fall back to NDJSON event count
    const envelopeData = captureResult.envelope?.data as EndstateCaptureData | undefined;
    let capturedCount = 0;
    
    if (envelopeData?.counts?.included !== undefined) {
      capturedCount = envelopeData.counts.included;
    } else if (envelopeData?.appsIncluded) {
      capturedCount = envelopeData.appsIncluded.length;
    } else {
      // Fallback: use NDJSON event count
      capturedCount = overviewCaptureEvents.length;
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
      });
    }

    // Update state with results
    const captureEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      success: true,
      summary: { total: capturedCount },
    };
    const newLifecycleState = recordLifecycleEvent('capture', captureEvent);
    setLifecycleState(newLifecycleState);
    
    await refreshProfiles();
    const discovered = await discoverProfiles(dir);
    if (discovered.length > 0) {
      const newest = discovered.sort((a, b) => b.path.localeCompare(a.path))[0];
      setSelectedProfile(newest.name);
      setSelectedProfilePath(newest.path);
      updateSettings({ lastSelectedProfile: newest.name, lastSelectedProfilePath: newest.path });
      
      // Prompt for optional display name
      await promptForProfileName(newest.path);
    }
    
    // Get app list from envelope data
    const appsList = envelopeData?.appsIncluded?.map(a => a.id) || [];
    
    // Get profile name from the newest discovered profile (refresh to get display name)
    const refreshedProfiles = await discoverProfiles(dir);
    const profileName = refreshedProfiles.length > 0 
      ? refreshedProfiles.sort((a, b) => b.path.localeCompare(a.path))[0].name 
      : 'Unknown';
    
    // Return structured result
    return { count: capturedCount, profileName, apps: appsList };
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
            setLiveAppEvents(previewAppEvents.length > 2000 ? previewAppEvents.slice(-2000) : [...previewAppEvents]);
            const uiStatus = getPhaseAwareStatusForEvent({
              statusKey: appEvent.statusKey || 'skipped',
              phase: 'apply',
              reason: appEvent.reason,
            });
            setOverviewActionProgress({ 
              message: 'Evaluating changes', 
              detail: `${uiStatus.longLabel}: ${ndjsonEvent.id}` 
            });
          }
        },
      }
    );
    
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
      });
    }
    
    // Record lifecycle event
    const previewEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      profile: selectedProfile,
      profilePath: selectedProfilePath,
      success: true,
      summary: { installed, alreadyPresent },
    };
    const newState = recordLifecycleEvent('preview', previewEvent);
    setLifecycleState(newState);
    
    setOverviewActionProgress({ 
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
    setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
    
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
            
            // Update live events for UI streaming
            setLiveAppEvents(checkAppEvents.length > 2000 ? checkAppEvents.slice(-2000) : [...checkAppEvents]);
            // Map verify counters to the existing counter structure
            setLiveCounters({ 
              installed: 0, 
              alreadyPresent: counters.confirmed, 
              skipped: counters.skipped, 
              failed: counters.missing 
            });
            
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
            
            setOverviewActionProgress({ 
              message: `${uiStatus.longLabel}: ${ndjsonEvent.id}`, 
              detail: counterText,
              phase: 'verify'
            });
          }
        },
      }
    );
    
    // Use collected events from NDJSON streaming
    const collectedEvents = [...checkAppEvents];

    logBufferRef.current?.flush();
    applyLineBufferRef.current?.clear();
    setIsRunning(false);

    // Process result
    const envelopeData = checkResult.envelope?.data as EndstateApplyResultData | undefined;
    const missing = envelopeData?.counts?.installed ?? 0; // "installed" in dry-run = would install = missing
    const present = envelopeData?.counts?.alreadyInstalled ?? 0;
    
    // Record lifecycle event as verify
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
      setOverviewActionProgress({ message: `${formatCount(missing, 'app')} missing, ${formatCount(present, 'app')} present` });
    } else {
      setOverviewActionProgress({ message: `All ${formatCount(present, 'app')} present` });
    }
    
    return { missing, present, profile: selectedProfile, appEvents: collectedEvents };
  };

  const handleApplyFromOverview = async () => {
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
    const counters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 };
    const verifyCounters = { confirmed: 0, missing: 0, total: 0 };
    let currentPhase: EnginePhase = 'apply';
    let hasInsertedApplyHeader = false;
    let hasInsertedVerifyHeader = false;
    
    const applyResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      ['--profile', selectedProfilePath],
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
              setLiveAppEvents([...appEventList]);
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
              setLiveAppEvents([...appEventList]);
              setOverviewActionProgress({ 
                message: 'Verifying installation…',
                detail: `Verifying… 0/${verifyCounters.total || '?'}`,
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
            
            // Update live events for UI
            setLiveAppEvents(appEventList.length > 2000 ? appEventList.slice(-2000) : [...appEventList]);
            setLiveCounters({ ...counters });
            
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
              setOverviewActionProgress({ 
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
              
              setOverviewActionProgress({ 
                message: `${uiStatus.longLabel}: ${ndjsonEvent.id}`,
                detail: counterText,
                phase: 'apply'
              });
            }
          }
        },
      }
    );

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
    
    setLiveCounters({ installed, alreadyPresent, skipped, failed });

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
      });
    }
    
    // Record lifecycle event
    const applyEvent: LifecycleEvent = {
      timestamp: new Date().toISOString(),
      profile: selectedProfile,
      profilePath: selectedProfilePath,
      success: isSuccess,
      summary: { installed, alreadyPresent, failed },
    };
    const newState = recordLifecycleEvent('apply', applyEvent);
    setLifecycleState(newState);
    
    // Update progress message based on outcome
    if (failed > 0) {
      setOverviewActionProgress({ 
        message: `${installed} installed, ${failed} failed`,
        detail: `${alreadyPresent} already present`
      });
    } else {
      setOverviewActionProgress({ 
        message: `${installed} installed, ${alreadyPresent} already present` 
      });
    }
    
    return { installed, alreadyPresent, failed, skipped, profile: selectedProfile, appEvents: reconciledEvents };
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">Loading...</h2>
              <p className="text-sm text-muted-foreground mt-1">Running: endstate capabilities --json</p>
            </div>
          </CardContent>
        </Card>
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

  // Error banner component (non-blocking)
  const renderErrorBanner = () => {
    if (state.status !== 'error') return null;
    
    return (
      <Card className="border-destructive bg-destructive/5 mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-destructive text-base">Engine Connection Issue</CardTitle>
              <CardDescription className="text-destructive/80">
                {state.errorMessage || 'Unable to connect to the endstate engine'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={loadInitialData}>
                Retry
              </Button>
              <Button size="sm" variant="secondary" onClick={() => {
                setSafeMode(true);
                setState(prev => ({ ...prev, status: 'ready' }));
              }}>
                Safe Mode
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {state.errorCommand && (
            <div className="text-xs">
              <span className="text-muted-foreground">Command: </span>
              <code className="bg-muted px-1 rounded">{state.errorCommand}</code>
            </div>
          )}
          
          {/* Collapsible diagnostics */}
          <details open={showDiagnostics} onToggle={(e) => setShowDiagnostics((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {showDiagnostics ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Diagnostics
            </summary>
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1 font-mono">
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
              className="mt-2 h-7 text-xs relative"
              onClick={copyDiagnostics}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy Diagnostics
              <InlineFeedbackPopover feedback={diagnosticsCopyFeedback.feedback} />
            </Button>
          </details>
          
          {state.errorStderr && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                STDERR output
              </summary>
              <pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">{state.errorStderr}</pre>
            </details>
          )}
        </CardContent>
      </Card>
    );
  };

  // Note: Error state no longer blocks UI - it shows a banner instead

  const renderPage = () => {
    // Show error banner at top of any page when in error state
    const errorBanner = renderErrorBanner();
    
    switch (currentPage) {
      case 'overview':
        return (
          <div className="space-y-6">
            {errorBanner}
            <OverviewScreen
              lifecycleState={lifecycleState}
              selectedProfile={selectedProfile}
              profiles={profiles}
              profilesDirectory={profilesDirectory}
              isRunning={isRunning}
              runningAction={overviewRunningAction}
              actionStatus={overviewActionStatus}
              actionProgress={overviewActionProgress}
              actionResult={overviewActionResult}
              liveAppEvents={liveAppEvents}
              liveCounters={liveCounters}
              initialExpandedCard={overviewExpandedCard}
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
                if (import.meta.env.DEV) {
                  console.log(`[RUN START] Capture runId=${runId}`);
                }
                setOverviewRunningAction('capture');
                setOverviewActionStatus('running');
                setOverviewActionProgress({ message: 'Scanning installed applications...' });
                try {
                  const result = await handleCaptureFromOverview();
                  setOverviewActionStatus('success');
                  const countText = result.count === 0 
                    ? 'No apps detected' 
                    : `${result.count} apps captured`;
                  setOverviewActionProgress({ message: countText });
                  setOverviewActionResult({ 
                    action: 'capture', 
                    status: 'success', 
                    summary: countText,
                    profile: result.profileName,
                    timestamp: new Date().toISOString(),
                    counts: { total: result.count },
                    appEvents: result.apps?.map(app => ({ app, action: 'Captured', statusKey: 'detected' as const, phase: 'capture' as const })),
                  });
                } catch (err) {
                  setOverviewActionStatus('error');
                  setOverviewActionResult({ 
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
                }
              }}
              onSetup={async (intent) => {
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
                if (import.meta.env.DEV) {
                  console.log(`[RUN START] Setup ${intent} runId=${runId}`);
                }
                setLiveAppEvents([]);
                setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
                
                setOverviewRunningAction('setup');
                setOverviewActionStatus('running');
                const isApply = intent === 'apply';
                setOverviewActionProgress({ 
                  message: isApply ? 'Installing applications...' : 'Evaluating changes' 
                });
                try {
                  if (isApply) {
                    const result = await handleApplyFromOverview();
                    // Set status based on whether there were failures
                    const hasFailures = result.failed > 0;
                    setOverviewActionStatus(hasFailures ? 'error' : 'success');
                    setOverviewActionResult({ 
                      action: 'setup', 
                      status: hasFailures ? 'error' : 'success', 
                      summary: hasFailures 
                        ? `${result.installed} installed, ${result.failed} failed`
                        : `${result.installed} installed, ${result.alreadyPresent} already present`,
                      profile: result.profile,
                      timestamp: new Date().toISOString(),
                      counts: {
                        installed: result.installed,
                        alreadyPresent: result.alreadyPresent,
                        skipped: result.skipped,
                        failed: result.failed,
                        manifestTotal: result.installed + result.alreadyPresent + result.skipped + result.failed,
                      },
                      appEvents: result.appEvents,
                    });
                  } else {
                    const result = await handlePreviewFromOverview();
                    setOverviewActionStatus('success');
                    setOverviewActionResult({ 
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
                  setOverviewActionStatus('error');
                  setOverviewActionResult({ 
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
                if (import.meta.env.DEV) {
                  console.log(`[RUN START] Check runId=${runId}`);
                }
                
                setOverviewRunningAction('check');
                setOverviewActionStatus('running');
                setOverviewActionProgress({ message: 'Checking computer...' });
                try {
                  const result = await handleCheckFromOverview();
                  setOverviewActionStatus('success');
                  const summaryText = result.missing > 0 
                    ? `${formatCount(result.missing, 'app')} missing, ${formatCount(result.present, 'app')} present`
                    : `All ${formatCount(result.present, 'app')} present`;
                  setOverviewActionResult({ 
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
                  setOverviewActionStatus('error');
                  setOverviewActionResult({ 
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
                }
              }}
              onProfileChange={(profile, path) => {
                setSelectedProfile(profile);
                setSelectedProfilePath(path);
                updateSettings({ lastSelectedProfile: profile, lastSelectedProfilePath: path });
              }}
              onDismissResult={dismissOverviewResult}
              onOpenProfilesFolder={handleOpenProfilesFolder}
              onRefreshProfiles={refreshProfiles}
              onRenameProfile={(path, currentName) => {
                openProfileNameModal(path, currentName, 'rename');
              }}
              onRenameFile={(path, currentFilename) => {
                openRenameFileModal(path, currentFilename);
              }}
              onDeleteProfile={(path, displayName) => {
                setDeleteProfilePath(path);
                setDeleteProfileName(displayName);
                setShowDeleteProfileModal(true);
              }}
              onSetActiveProfile={handleSetActiveProfile}
            />
          </div>
        );

      case 'report':
        // Build recent runs from lifecycle state and last run data
        const recentRuns: Array<{
          id: string;
          timestamp: string;
          command: string;
          mode: 'preview' | 'apply' | 'capture' | 'verify';
          profile?: string;
          status: 'success' | 'partial' | 'failed';
          summary: { installed?: number; alreadyPresent?: number; failed?: number; captured?: number };
          artifactBundle?: RunBundle;
        }> = [];
        
        // Add from lifecycle state
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
          });
        }
        
        // Add from lastRunCapture/lastRunApply if not already in lifecycle
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
        
        // Map artifacts to recent runs by matching timestamps
        // runArtifacts use ISO timestamps, recentRuns also use ISO timestamps
        for (const run of recentRuns) {
          const runTime = new Date(run.timestamp).getTime();
          // Find artifact within 5 second window (accounts for slight timing differences)
          const matchingArtifact = runArtifacts.find(({ summary }) => {
            const artifactTime = new Date(summary.timestamp).getTime();
            return Math.abs(runTime - artifactTime) < 5000 && summary.mode === run.mode;
          });
          if (matchingArtifact) {
            run.artifactBundle = matchingArtifact.bundle;
          }
        }
        
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Report"
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
                          
                          {/* Artifact status and actions - show appropriate message/actions based on run state */}
                          <div className="col-span-2 pt-2 border-t border-border mt-2">
                            {activeRunId && overviewRunningAction === run.mode ? (
                              <span className="text-xs text-muted-foreground italic">
                                Run in progress
                              </span>
                            ) : run.artifactBundle ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={async () => {
                                    try {
                                      const logContent = await invoke<string>('read_text_file', { path: run.artifactBundle!.logPath });
                                      await copyText(logContent);
                                      showToast('Logs copied to clipboard', 'success');
                                    } catch (err) {
                                      console.error('Failed to read logs:', err);
                                      showToast('Failed to read logs', 'error');
                                    }
                                  }}
                                >
                                  <FileText className="h-3 w-3" />
                                  View logs
                                </Button>
                                {isTauriRuntime() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={async () => {
                                      try {
                                        await openFolder(run.artifactBundle!.directory);
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
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No logs captured for this run
                              </span>
                            )}
                          </div>
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
                        <div className="px-2 pb-2 pt-1 border-t border-border bg-muted/30">
                          <div className="flex flex-wrap gap-2 mt-1">
                            {isTauriRuntime() ? (
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
                            ) : (
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
              <div className="text-xs text-muted-foreground text-center py-2">
                Artifacts not saved in web mode
              </div>
            )}
            
            {/* Backend Report Data (if available) */}
            {state.report?.data?.reports && state.report.data.reports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Engine Reports</CardTitle>
                  <CardDescription className="text-xs">Data from endstate engine</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {state.report.data.reports.slice(0, 5).map((report) => (
                      <div key={report.runId} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{report.command}</span>
                          {report.dryRun && <span className="text-xs text-muted-foreground">(preview)</span>}
                          {report.manifest?.name && (
                            <span className="text-muted-foreground">• {report.manifest.name}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(report.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
      case 'overview': return '';
      case 'report': return 'Report';
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
      <Dialog open={showProfileNameModal} onOpenChange={setShowProfileNameModal}>
        <DialogContent data-testid="profile-name-modal" role="dialog">
          <DialogHeader>
            <DialogTitle>{profileNameModalMode === 'rename' ? 'Rename profile' : 'Save profile'}</DialogTitle>
            <DialogDescription>
              {profileNameModalMode === 'rename' 
                ? 'Enter a new name for this profile.'
                : 'Give this profile a name (optional).'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
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
            {profileNameModalMode === 'rename' && (
              <div>
                <button
                  onClick={() => setProfileNameModalMoreOptions(!profileNameModalMoreOptions)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {profileNameModalMoreOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {profileNameModalMoreOptions ? 'Hide details' : 'More options'}
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
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowProfileNameModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfileName}>
              {profileNameModalMode === 'rename' ? 'Rename' : 'Save profile'}
            </Button>
          </DialogFooter>
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
