import { useEffect, useState, useRef } from 'react';
import {
  EndstateEnvelope,
  EndstateCapabilitiesData,
  EndstateVerifyData,
  EndstateReportData,
  EndstateApplyData,
  EndstateCaptureData,
  CapturedApp,
  CaptureCounts,
  EndstateApplyResultData,
} from './types';
import { AppSettings, loadSettings, saveSettings } from './settings';
import { discoverProfiles, DiscoveredProfile } from './file-discovery';
import { StreamEvent } from './streaming-runner';
import { runEngineStreaming } from './lib/engine';
import { LogBuffer } from './log-buffer';
import { parseCaptureOutput, type CaptureStats } from './lib/log-parse';
import { parseApplyProgressLine, StreamingLineBuffer, reconcileLiveActivity, type AppEvent } from './lib/apply-utils';
import { saveLastRun, loadLastRunForCommand, migrateLegacyLastRun, type LastRunData } from './lib/last-run';
import { loadLifecycleState, recordLifecycleEvent, hasRecentScan, formatRelativeTime, type LifecycleState, type LifecycleEvent } from './lib/lifecycle-state';
import { loadUIMode, saveUIMode, toggleUIMode, type UIMode } from './lib/ui-mode';
import { OverviewScreen } from './components/app/overview-screen';
import { getProfilesDirectory, ensureDirectory, isTauriRuntime, openFolder } from './lib/tauri-bridge';
import { runEndstateOnce, getErrorMessage } from './lib/engine-exec';
import { saveProfileMetadata, deleteProfileFiles } from './lib/profile-metadata';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/layout/command-palette';
import { PageHeader } from './components/app/page-header';
import { LogViewer } from './components/app/log-viewer';
import { ActivityLog } from './components/app/activity-log';
import { CaptureResultModal } from './components/app/capture-result-modal';
import { ApplyResultModal } from './components/app/apply-result-modal';
import type { ApplyCounts, ApplyItem } from './types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Switch } from './components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { Loader2, Copy, ChevronDown, ChevronRight } from 'lucide-react';

type AppStatus = 'loading' | 'ready' | 'error';
type PageType = 'overview' | 'capture' | 'apply' | 'verify' | 'report' | 'settings';
type CheckStep = 'idle' | 'scanning' | 'comparing' | 'ready';

/**
 * Apply run phase state machine:
 * - idle: No apply operation in progress
 * - previewing: Running apply --dry-run
 * - previewResult: Showing preview modal with dry-run results
 * - applying: Running actual apply (from preview modal CTA)
 * - applyResult: Showing apply modal with real results
 */
type ApplyRunPhase = 'idle' | 'previewing' | 'previewResult' | 'applying' | 'applyResult';

interface ActivityItem {
  id: string;
  message: string;
  status: 'running' | 'success' | 'error';
  timestamp: Date;
  step?: number;
}

interface AppState {
  status: AppStatus;
  errorMessage: string | null;
  errorStderr: string | null;
  errorCommand: string | null;
  capabilities: EndstateEnvelope<EndstateCapabilitiesData> | null;
  report: EndstateEnvelope<EndstateReportData> | null;
  verify: EndstateEnvelope<EndstateVerifyData> | null;
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [currentPage, setCurrentPage] = useState<PageType>('overview');
  const [previousPage, setPreviousPage] = useState<PageType | null>(null);
  const [uiMode, setUIMode] = useState<UIMode>(loadUIMode());
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
  const [runLogs, setRunLogs] = useState<string>('');
  const [logTruncated, setLogTruncated] = useState(false);
  const [checkStep, setCheckStep] = useState<CheckStep>('idle');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<string>('');
  const [captureStats, setCaptureStats] = useState<CaptureStats>({ succeeded: 0, skipped: 0, failed: 0, outputPath: '', lastProcessedApp: '', processedCount: 0, apps: [] });
  const [captureData, setCaptureData] = useState<{ counts: CaptureCounts; appsIncluded: CapturedApp[]; outputPath: string; rawEnvelope?: object }>({
    counts: { totalFound: 0, included: 0, skipped: 0, filteredRuntimes: 0, filteredStoreApps: 0, sensitiveExcludedCount: 0 },
    appsIncluded: [],
    outputPath: '',
  });
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  // Per-command last run state
  const [lastRunCapture, setLastRunCapture] = useState<LastRunData | null>(null);
  const [lastRunApply, setLastRunApply] = useState<LastRunData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lastRunVerify, setLastRunVerify] = useState<LastRunData | null>(null);
  const [safeMode, setSafeMode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const logBufferRef = useRef<LogBuffer | null>(null);
  
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
  const [overviewActionProgress, setOverviewActionProgress] = useState<{ message: string; detail?: string } | null>(null);
  const [overviewActionResult, setOverviewActionResult] = useState<OverviewActionResult | null>(null);
  const [liveAppEvents, setLiveAppEvents] = useState<AppEvent[]>([]);
  const [liveCounters, setLiveCounters] = useState<LiveCounters>({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
  const isRunningRef = useRef(false); // Robust guard against double-run
  const [showFolderPathModal, setShowFolderPathModal] = useState(false);
  const [folderPathForModal, setFolderPathForModal] = useState('');
  
  // Profile naming modal state
  const [showProfileNameModal, setShowProfileNameModal] = useState(false);
  const [profileNameModalPath, setProfileNameModalPath] = useState('');
  const [profileNameModalValue, setProfileNameModalValue] = useState('');
  const [profileNameModalMode, setProfileNameModalMode] = useState<'save' | 'rename'>('save');
  
  // Profile delete confirmation modal state
  const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);
  const [deleteProfilePath, setDeleteProfilePath] = useState('');
  const [deleteProfileName, setDeleteProfileName] = useState('');
  
  // Reset overview action state
  const resetOverviewActionState = () => {
    setOverviewRunningAction(null);
    setOverviewActionStatus('idle');
    setOverviewActionProgress(null);
    setOverviewActionResult(null);
    setLiveAppEvents([]);
    setLiveCounters({ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 });
    isRunningRef.current = false;
  };

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
      // Reset overview action state to prevent stale state when returning
      resetOverviewActionState();
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
  
  // Handle UI mode toggle with persistence
  const handleToggleUIMode = () => {
    const newMode = toggleUIMode(uiMode);
    setUIMode(newMode);
    saveUIMode(newMode);
  };
  
  // Apply modal state - single source of truth for apply flow
  const [applyRunPhase, setApplyRunPhase] = useState<ApplyRunPhase>('idle');
  const [applyData, setApplyData] = useState<{ counts: ApplyCounts; items: ApplyItem[]; rawEnvelope?: object }>({
    counts: { total: 0, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
    items: [],
  });
  const [applyProgress, setApplyProgress] = useState<{ currentApp: string; action: string }>({ currentApp: '', action: '' });
  
  // Derived state from applyRunPhase
  const showApplyModal = applyRunPhase === 'previewResult' || applyRunPhase === 'applyResult';
  const applyModalIsDryRun = applyRunPhase === 'previewResult';

  const updateActivity = (message: string, status: ActivityItem['status'], step?: number) => {
    setActivities((prev) => {
      if (step) {
        const existingIndex = prev.findIndex(a => a.step === step);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            message,
            status,
            timestamp: new Date(),
          };
          return updated;
        }
      }
      return [...prev, {
        id: `step-${step || Date.now()}`,
        message,
        status,
        timestamp: new Date(),
        step,
      }];
    });
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
      await refreshProfiles();
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
    setShowDeleteProfileModal(false);
    setDeleteProfilePath('');
    setDeleteProfileName('');
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

  useEffect(() => {
    // Only clear capture-specific UI state on navigation, not run state
    if (currentPage !== 'capture') {
      if (captureProgress) {
        setCaptureProgress('');
      }
    }
    // Note: We intentionally do NOT clear activities or checkStep on navigation
    // so that users can navigate away and return to see the same run state
  }, [currentPage]);

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
  };

  useEffect(() => {
    if (settings.engineMode && (settings.engineMode === 'path' || settings.engineScriptPath)) {
      loadInitialData();
    }
  }, [settings.engineMode, settings.engineScriptPath]);

  // Preview changes using apply --dry-run
  const handlePreviewChanges = async () => {
    if (!selectedProfile) {
      alert('Please select a setup');
      return;
    }

    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    setCheckStep('scanning');
    setActivities([]);
    setApplyProgress({ currentApp: '', action: '' });
    
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });
    applyLineBufferRef.current = new StreamingLineBuffer();

    updateActivity('Analyzing setup profile...', 'running', 1);

    try {
      // Run apply --dry-run to preview changes
      const applyResult = await runEngineStreaming<EndstateApplyData>(
        settings,
        'apply',
        ['--profile', selectedProfilePath, '--dry-run'],
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
            
            // Parse real-time progress
            const completeLines = applyLineBufferRef.current?.append(event.data) || [];
            for (const line of completeLines) {
              const progress = parseApplyProgressLine(line);
              if (progress) {
                setApplyProgress({ currentApp: progress.app, action: progress.action });
                updateActivity(`${progress.action}: ${progress.app}`, 'running', 1);
              }
            }
          }
        }
      );

      // Process apply result
      if (applyResult.envelope) {
        const envelopeData = applyResult.envelope.data as EndstateApplyResultData | undefined;
        
        // Dev-only debug: log parsed apply envelope shape
        if (import.meta.env.DEV) {
          console.log('[ApplyEnvelope] Preview result:', {
            hasItems: !!envelopeData?.items,
            itemsLength: envelopeData?.items?.length ?? 0,
            hasCounts: !!envelopeData?.counts,
            counts: envelopeData?.counts,
            itemsByReason: envelopeData?.items?.reduce((acc, item) => {
              acc[item.reason || 'unknown'] = (acc[item.reason || 'unknown'] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          });
        }
        
        if (envelopeData?.counts && envelopeData?.items) {
          setApplyData({
            counts: envelopeData.counts,
            items: envelopeData.items,
            rawEnvelope: applyResult.envelope,
          });
        } else {
          // Fallback: construct counts from legacy fields
          const installed = envelopeData?.installed ?? 0;
          const skipped = envelopeData?.skipped ?? 0;
          const failed = envelopeData?.failed ?? 0;
          setApplyData({
            counts: {
              total: installed + skipped + failed,
              installed: installed,
              alreadyInstalled: skipped,
              skippedFiltered: 0,
              failed: failed,
            },
            items: [],
            rawEnvelope: applyResult.envelope,
          });
        }
      }

      updateActivity('Preview ready', 'success', 1);
      setCheckStep('ready');
      setApplyRunPhase('previewResult');  // Show preview modal
      
      // Record lifecycle event for preview
      const previewEvent: LifecycleEvent = {
        timestamp: new Date().toISOString(),
        profile: selectedProfile,
        profilePath: selectedProfilePath,
        success: true,
        summary: {
          total: applyResult.envelope?.data ? (applyResult.envelope.data as EndstateApplyResultData).counts?.total : 0,
          installed: applyResult.envelope?.data ? (applyResult.envelope.data as EndstateApplyResultData).counts?.installed : 0,
          alreadyPresent: applyResult.envelope?.data ? (applyResult.envelope.data as EndstateApplyResultData).counts?.alreadyInstalled : 0,
          failed: applyResult.envelope?.data ? (applyResult.envelope.data as EndstateApplyResultData).counts?.failed : 0,
        },
      };
      const newState = recordLifecycleEvent('preview', previewEvent);
      setLifecycleState(newState);
    } catch (err) {
      updateActivity('Preview failed', 'error');
      setCheckStep('idle');
      alert(`Failed to preview changes: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      applyLineBufferRef.current?.clear();
      setIsRunning(false);
      setApplyProgress({ currentApp: '', action: '' });
    }
  };

  // Ref for streaming line buffer (handles partial lines)
  const applyLineBufferRef = useRef<StreamingLineBuffer | null>(null);
  
  // Idempotency guard: prevent double-click / Enter / re-render from starting apply twice
  const applyInProgressRef = useRef(false);

  /**
   * Handle "Apply changes" from preview modal.
   * Transitions from previewResult -> applying -> applyResult.
   * This ensures only ONE apply execution occurs after preview.
   */
  const handleApplyFromPreview = async () => {
    // Idempotency guard: if apply is already in progress, ignore
    if (applyInProgressRef.current) {
      return;
    }
    
    if (!selectedProfile) {
      alert('Please select a setup');
      return;
    }

    // Lock immediately before any async work
    applyInProgressRef.current = true;

    // Transition to applying state - modal stays open with "Applying..." message
    setApplyRunPhase('applying');
    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    setApplyProgress({ currentApp: '', action: '' });
    setActivities([]);
    updateActivity('Applying changes...', 'running', 1);
    
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });
    applyLineBufferRef.current = new StreamingLineBuffer();

    try {
      // Run actual apply (no --dry-run)
      const applyResult = await runEngineStreaming<EndstateApplyData>(
        settings,
        'apply',
        ['--profile', selectedProfilePath],
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
            
            const completeLines = applyLineBufferRef.current?.append(event.data) || [];
            for (const line of completeLines) {
              const progress = parseApplyProgressLine(line);
              if (progress) {
                setApplyProgress({ currentApp: progress.app, action: progress.action });
                updateActivity(`${progress.action}: ${progress.app}`, 'running', 1);
              }
            }
          }
        }
      );

      // Process apply result
      if (applyResult.envelope) {
        const envelopeData = applyResult.envelope.data as EndstateApplyResultData | undefined;
        
        if (envelopeData?.counts && envelopeData?.items) {
          setApplyData({
            counts: envelopeData.counts,
            items: envelopeData.items,
            rawEnvelope: applyResult.envelope,
          });
        } else {
          const installed = envelopeData?.installed ?? 0;
          const skipped = envelopeData?.skipped ?? 0;
          const failed = envelopeData?.failed ?? 0;
          setApplyData({
            counts: {
              total: installed + skipped + failed,
              installed: installed,
              alreadyInstalled: skipped,
              skippedFiltered: 0,
              failed: failed,
            },
            items: [],
            rawEnvelope: applyResult.envelope,
          });
        }
        
        updateActivity(
          applyResult.envelope.success ? 'Setup complete' : 'Setup completed with issues',
          applyResult.envelope.success ? 'success' : 'error',
          1
        );
      }

      // Save last run to localStorage (per-command)
      const envelopeData = applyResult.envelope?.data as EndstateApplyResultData | undefined;
      const lastRunData: LastRunData = {
        timestamp: new Date().toISOString(),
        command: 'apply',
        profile: selectedProfile,
        outcome: {
          installed: envelopeData?.counts?.installed ?? 0,
          alreadyPresent: envelopeData?.counts?.alreadyInstalled ?? 0,
          needsAttention: envelopeData?.counts?.failed ?? 0,
        },
      };
      saveLastRun(lastRunData);
      setLastRunApply(lastRunData);

      // Refresh report state
      const reportResult = await runEngineStreaming<EndstateReportData>(
        settings,
        'report',
        [],
        () => {}
      );
      setState((prev) => ({
        ...prev,
        report: reportResult.envelope,
      }));

      // Transition to applyResult - show final results
      setApplyRunPhase('applyResult');
      setCheckStep('ready');
      
      // Record lifecycle event for apply
      const applyEvent: LifecycleEvent = {
        timestamp: new Date().toISOString(),
        profile: selectedProfile,
        profilePath: selectedProfilePath,
        success: applyResult.envelope?.success ?? true,
        summary: {
          total: envelopeData?.counts?.total ?? 0,
          installed: envelopeData?.counts?.installed ?? 0,
          alreadyPresent: envelopeData?.counts?.alreadyInstalled ?? 0,
          failed: envelopeData?.counts?.failed ?? 0,
        },
      };
      const newLifecycleState = recordLifecycleEvent('apply', applyEvent);
      setLifecycleState(newLifecycleState);
    } catch (err) {
      updateActivity('Apply failed', 'error', 1);
      setApplyRunPhase('idle');
      setCheckStep('idle');
      alert(`Failed to apply changes: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      applyLineBufferRef.current?.clear();
      setIsRunning(false);
      setApplyProgress({ currentApp: '', action: '' });
      // Release idempotency lock
      applyInProgressRef.current = false;
    }
  };

  const handleSetupMachine = async () => {
    if (!selectedProfile) {
      alert('Please select a setup');
      return;
    }

    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    setApplyProgress({ currentApp: '', action: '' });
    setActivities([]);
    updateActivity('Starting setup...', 'running', 1);
    
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });
    
    // Initialize streaming line buffer for robust partial line handling
    applyLineBufferRef.current = new StreamingLineBuffer();

    try {
      const args = ['--profile', selectedProfilePath];
      if (settings.dryRunEnabled) {
        args.push('--dry-run');
      }

      const applyResult = await runEngineStreaming<EndstateApplyData>(
        settings,
        'apply',
        args,
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
            
            // Parse real-time progress using streaming line buffer
            const completeLines = applyLineBufferRef.current?.append(event.data) || [];
            for (const line of completeLines) {
              const progress = parseApplyProgressLine(line);
              if (progress) {
                setApplyProgress({ currentApp: progress.app, action: progress.action });
                updateActivity(`${progress.action}: ${progress.app}`, 'running', 1);
              }
            }
          }
        }
      );

      // Process apply result and show modal
      if (applyResult.envelope) {
        const envelopeData = applyResult.envelope.data as EndstateApplyResultData | undefined;
        
        // Dev-only debug: log parsed apply envelope shape
        if (import.meta.env.DEV) {
          console.log('[ApplyEnvelope] Apply result:', {
            hasItems: !!envelopeData?.items,
            itemsLength: envelopeData?.items?.length ?? 0,
            hasCounts: !!envelopeData?.counts,
            counts: envelopeData?.counts,
            itemsByReason: envelopeData?.items?.reduce((acc, item) => {
              acc[item.reason || 'unknown'] = (acc[item.reason || 'unknown'] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          });
        }
        
        if (envelopeData?.counts && envelopeData?.items) {
          // Use structured envelope data
          setApplyData({
            counts: envelopeData.counts,
            items: envelopeData.items,
            rawEnvelope: applyResult.envelope,
          });
        } else {
          // Fallback: construct counts from legacy fields
          const installed = envelopeData?.installed ?? 0;
          const skipped = envelopeData?.skipped ?? 0;
          const failed = envelopeData?.failed ?? 0;
          setApplyData({
            counts: {
              total: installed + skipped + failed,
              installed: installed,
              alreadyInstalled: skipped, // Legacy: skipped usually means already installed
              skippedFiltered: 0,
              failed: failed,
            },
            items: [],
            rawEnvelope: applyResult.envelope,
          });
        }
        
        updateActivity(
          applyResult.envelope.success ? 'Setup complete' : 'Setup completed with issues',
          applyResult.envelope.success ? 'success' : 'error',
          1
        );
        setApplyRunPhase('applyResult');  // Show apply result modal
      }

      // Refresh report state
      const reportResult = await runEngineStreaming<EndstateReportData>(
        settings,
        'report',
        [],
        () => {}
      );
      setState((prev) => ({
        ...prev,
        report: reportResult.envelope,
      }));
    } catch (err) {
      updateActivity(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error', 1);
      alert(`Failed to run apply: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      applyLineBufferRef.current?.clear();
      setIsRunning(false);
      setApplyProgress({ currentApp: '', action: '' });
    }
  };

  const handleCapture = async () => {
    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    setCaptureProgress('');
    setCaptureStats({ succeeded: 0, skipped: 0, failed: 0, outputPath: '', lastProcessedApp: '', processedCount: 0, apps: [] });
    setShowTechnicalDetails(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(prev => prev + logs);
      setLogTruncated(truncated);
    });

    try {
      const dir = await loadProfilesDirectory();
      if (!dir) {
        setCaptureProgress('Failed to determine profiles directory');
        setIsRunning(false);
        return;
      }
      
      await ensureDirectory(dir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const filename = `setup_${timestamp}.jsonc`;
      const outputPath = `${dir}\\${filename}`;

      const captureResult = await runEngineStreaming(
        settings,
        'capture',
        ['--out', outputPath],
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
            
            // Parse live progress from streaming logs
            const parsed = parseCaptureOutput(runLogs + event.data);
            if (parsed.lastProcessedApp) {
              setCaptureProgress(parsed.lastProcessedApp);
            }
            // Update stats for processedCount display
            if (parsed.processedCount > 0) {
              setCaptureStats(prev => ({ ...prev, processedCount: parsed.processedCount }));
            }
          }
        }
      );

      const isSuccess = captureResult.envelope?.success ?? (captureResult.exitCode === 0);
      
      if (isSuccess) {
        // Get stats from envelope data (preferred) or fall back to log parsing
        const envelopeData = captureResult.envelope?.data as EndstateCaptureData | undefined;
        
        // Use new structured envelope data
        if (envelopeData?.counts && envelopeData?.appsIncluded) {
          setCaptureData({
            counts: envelopeData.counts,
            appsIncluded: envelopeData.appsIncluded,
            outputPath: envelopeData.outputPath || outputPath,
            rawEnvelope: captureResult.envelope || undefined,
          });
        } else {
          // Fall back to log parsing if envelope doesn't have the new structure
          const finalStats = parseCaptureOutput(runLogs);
          setCaptureData({
            counts: {
              totalFound: finalStats.succeeded + finalStats.skipped,
              included: finalStats.succeeded,
              skipped: finalStats.skipped,
              filteredRuntimes: 0,
              filteredStoreApps: 0,
              sensitiveExcludedCount: 0,
            },
            appsIncluded: finalStats.apps.filter(a => a.status === 'ok').map(a => ({ id: a.id, source: a.driver })),
            outputPath: finalStats.outputPath || envelopeData?.outputPath || outputPath,
            rawEnvelope: captureResult.envelope || undefined,
          });
        }
        
        // Also update legacy captureStats for backward compatibility
        const finalStats = parseCaptureOutput(runLogs);
        setCaptureStats(finalStats);
        
        // Save Last Run (per-command)
        const lastRunData: LastRunData = {
          timestamp: new Date().toISOString(),
          command: 'capture',
          outcome: {
            succeeded: finalStats.succeeded,
            skipped: finalStats.skipped,
            failed: finalStats.failed,
          },
        };
        saveLastRun(lastRunData);
        setLastRunCapture(lastRunData);
        
        // Record lifecycle event for capture
        const captureEvent: LifecycleEvent = {
          timestamp: new Date().toISOString(),
          success: true,
          summary: {
            total: finalStats.succeeded,
          },
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
        
        setShowCaptureModal(true);
      } else {
        const friendlyMsg = captureResult.envelope?.error?.message || 
                           'Endstate couldn\'t save the setup. Please try again.';
        setCaptureProgress(`Error: ${friendlyMsg}`);
      }

    } catch (err) {
      setCaptureProgress(`Failed to scan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      setIsRunning(false);
    }
  };

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

    const captureResult = await runEngineStreaming(
      settings,
      'capture',
      ['--out', outputPath],
      (event: StreamEvent) => {
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
          const parsed = parseCaptureOutput(runLogs + event.data);
          if (parsed.lastProcessedApp) {
            setOverviewActionProgress({ 
              message: 'Scanning applications...', 
              detail: parsed.lastProcessedApp 
            });
          }
        }
      }
    );

    logBufferRef.current?.flush();
    setIsRunning(false);

    const isSuccess = captureResult.envelope?.success ?? (captureResult.exitCode === 0);
    
    if (!isSuccess) {
      throw new Error(captureResult.envelope?.error?.message || 'Capture failed');
    }

    // Get count from envelope data (preferred) or fall back to log parsing
    const envelopeData = captureResult.envelope?.data as EndstateCaptureData | undefined;
    let capturedCount = 0;
    
    if (envelopeData?.counts?.included !== undefined) {
      capturedCount = envelopeData.counts.included;
    } else if (envelopeData?.appsIncluded) {
      capturedCount = envelopeData.appsIncluded.length;
    } else {
      // Fall back to log parsing
      const finalStats = parseCaptureOutput(runLogs);
      capturedCount = finalStats.succeeded;
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

    // Collect app events during preview - deduplicated by app
    const appEventMap = new Map<string, AppEvent>();
    
    const applyResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      ['--profile', selectedProfilePath, '--dry-run'],
      (event: StreamEvent) => {
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
          const completeLines = applyLineBufferRef.current?.append(event.data) || [];
          for (const line of completeLines) {
            const progress = parseApplyProgressLine(line);
            if (progress) {
              // Track per-app events for preview - deduplicated
              const appEvent: AppEvent = { app: progress.app, action: progress.action, timestamp: Date.now() };
              appEventMap.set(progress.app, appEvent);
              setLiveAppEvents(Array.from(appEventMap.values()).slice(-20));
              
              setOverviewActionProgress({ 
                message: 'Evaluating changes', 
                detail: `Determining install actions… ${progress.app}` 
              });
            }
          }
        }
      }
    );
    
    // Convert map to array for final result
    const collectedEvents = Array.from(appEventMap.values());

    logBufferRef.current?.flush();
    applyLineBufferRef.current?.clear();
    setIsRunning(false);

    // Process result
    const envelopeData = applyResult.envelope?.data as EndstateApplyResultData | undefined;
    const installed = envelopeData?.counts?.installed ?? 0;
    const alreadyPresent = envelopeData?.counts?.alreadyInstalled ?? 0;
    
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

    // Collect app events during check
    const collectedEvents: AppEvent[] = [];
    
    // Use apply --dry-run for checking (same as preview)
    const checkResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      ['--profile', selectedProfilePath, '--dry-run'],
      (event: StreamEvent) => {
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
          const completeLines = applyLineBufferRef.current?.append(event.data) || [];
          for (const line of completeLines) {
            const progress = parseApplyProgressLine(line);
            if (progress) {
              // Track per-app events for check
              const appEvent: AppEvent = { app: progress.app, action: progress.action, timestamp: Date.now() };
              collectedEvents.push(appEvent);
              
              setOverviewActionProgress({ 
                message: 'Checking computer...', 
                detail: progress.app 
              });
            }
          }
        }
      }
    );

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
      setOverviewActionProgress({ message: `${missing} missing, ${present} present` });
    } else {
      setOverviewActionProgress({ message: `All ${present} apps present` });
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

    // Collect app events during streaming - maintain insertion order for append semantics
    const appEventList: AppEvent[] = []; // Append order preserved
    const appEventIndex = new Map<string, number>(); // Track last index per app for updates
    // Option A: Separate counters for truthful grouping
    const counters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 };
    
    const applyResult = await runEngineStreaming<EndstateApplyData>(
      settings,
      'apply',
      ['--profile', selectedProfilePath],
      (event: StreamEvent) => {
        if (event.type === 'stdout' || event.type === 'stderr') {
          logBufferRef.current?.append(event.data);
          const completeLines = applyLineBufferRef.current?.append(event.data) || [];
          for (const line of completeLines) {
            const progress = parseApplyProgressLine(line);
            if (progress) {
              const appEvent: AppEvent = { app: progress.app, action: progress.action, timestamp: Date.now() };
              
              // Append semantics: update existing entry in-place or append new
              const existingIndex = appEventIndex.get(progress.app);
              if (existingIndex !== undefined) {
                // Update existing entry in-place (maintains position)
                const existing = appEventList[existingIndex];
                // Only update counters when action changes to a final state
                const isFinalAction = ['Installed', 'Skipped', 'Failed', 'OK'].includes(progress.action);
                const wasNonFinal = existing.action === 'Processing' || existing.action === 'To install';
                
                if (isFinalAction && wasNonFinal) {
                  // Option A: Separate counters - OK goes to alreadyPresent, Skipped stays separate
                  if (progress.action === 'Installed') counters.installed++;
                  else if (progress.action === 'OK') counters.alreadyPresent++;
                  else if (progress.action === 'Skipped') counters.skipped++;
                  else if (progress.action === 'Failed') counters.failed++;
                }
                
                appEventList[existingIndex] = appEvent;
              } else {
                // Append new entry (stream order preserved)
                appEventIndex.set(progress.app, appEventList.length);
                appEventList.push(appEvent);
              }
              
              // Update live events for UI (show last 20, append order)
              setLiveAppEvents(appEventList.slice(-20));
              setLiveCounters({ ...counters });
              
              // Friendly headline mapping (Option A)
              // CRITICAL: During streaming, show in-progress action, not final disposition
              // Only show final labels (Skipped/Installed/etc) when the action is actually final
              const isFinalAction = ['Installed', 'Skipped', 'Failed', 'OK', 'Cancelled'].includes(progress.action);
              const friendlyAction = progress.action === 'OK' ? 'Already present' :
                                     progress.action === 'Processing' ? 'Installing' :
                                     progress.action === 'To install' ? 'Evaluating' :
                                     isFinalAction ? progress.action :
                                     'Working on';
              // Friendly counter text
              const parts: string[] = [];
              if (counters.installed > 0) parts.push(`${counters.installed} installed`);
              if (counters.alreadyPresent > 0) parts.push(`${counters.alreadyPresent} already present`);
              if (counters.skipped > 0) parts.push(`${counters.skipped} skipped`);
              if (counters.failed > 0) parts.push(`${counters.failed} failed`);
              const counterText = parts.join(' · ') || 'Working…';
              
              setOverviewActionProgress({ 
                message: `${friendlyAction}: ${progress.app}`,
                detail: counterText
              });
            }
          }
        }
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
    setLiveAppEvents(reconciledEvents.slice(-20));
    
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

  const handleImportProfile = async () => {
    const { invoke } = await import('./lib/tauri-bridge');

    try {
      const selected = await invoke<string | null>('show_file_dialog');

      if (selected) {
        const dir = await loadProfilesDirectory();
        if (!dir) {
          alert('Failed to determine profiles directory');
          return;
        }

        await invoke('import_profile', { sourcePath: selected, profilesDir: dir });
        alert('Setup imported successfully!');
        await refreshProfiles();
      }
    } catch (err) {
      alert(`Failed to import setup: ${err instanceof Error ? err.message : String(err)}`);
    }
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

  const supportsCapture = Array.isArray(state.capabilities?.data?.commands) && state.capabilities.data.commands.includes('capture');

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

  const copyDiagnostics = () => {
    const diag = getDiagnostics();
    const text = Object.entries(diag)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    navigator.clipboard.writeText(text);
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
            <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs" onClick={copyDiagnostics}>
              <Copy className="h-3 w-3 mr-1" /> Copy Diagnostics
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
              liveAppEvents={liveAppEvents}
              liveCounters={liveCounters}
              actionResult={overviewActionResult}
              uiMode={uiMode}
              onNavigate={navigateWithHistory}
              onOpenProfilesFolder={handleOpenProfilesFolder}
              onRefreshProfiles={refreshProfiles}
              selectedProfilePath={selectedProfilePath}
              onRenameProfile={(path, currentName) => {
                openProfileNameModal(path, currentName, 'rename');
              }}
              onDeleteProfile={(path, displayName) => {
                setDeleteProfilePath(path);
                setDeleteProfileName(displayName);
                setShowDeleteProfileModal(true);
              }}
              onOpenProfileFolder={async (path) => {
                // Open the folder containing the profile file
                const separator = path.includes('\\') ? '\\' : '/';
                const lastSepIndex = path.lastIndexOf(separator);
                const folderPath = lastSepIndex > 0 ? path.substring(0, lastSepIndex) : path;
                await openFolder(folderPath);
              }}
              onCapture={async () => {
                // Robust double-run guard using ref
                if (isRunning || isRunningRef.current) return;
                isRunningRef.current = true;
                
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
                    appEvents: result.apps?.map(app => ({ app, action: 'Captured' })),
                  });
                } catch (err) {
                  setOverviewActionStatus('error');
                  setOverviewActionResult({ 
                    action: 'capture', 
                    status: 'error', 
                    summary: err instanceof Error ? err.message : 'Capture failed' 
                  });
                } finally {
                  isRunningRef.current = false;
                }
              }}
              onSetup={async (intent) => {
                // Robust double-run guard using ref
                if (isRunning || isRunningRef.current) return;
                isRunningRef.current = true;
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
                  isRunningRef.current = false;
                }
              }}
              onCheck={async () => {
                // Robust double-run guard using ref
                if (isRunning || isRunningRef.current) return;
                isRunningRef.current = true;
                
                setOverviewRunningAction('check');
                setOverviewActionStatus('running');
                setOverviewActionProgress({ message: 'Checking computer...' });
                try {
                  const result = await handleCheckFromOverview();
                  setOverviewActionStatus('success');
                  const summaryText = result.missing > 0 
                    ? `${result.missing} missing, ${result.present} present`
                    : `All ${result.present} apps present`;
                  setOverviewActionResult({ 
                    action: 'check', 
                    status: 'success', 
                    summary: summaryText,
                    profile: result.profile,
                    timestamp: new Date().toISOString(),
                    counts: {
                      missing: result.missing,
                      alreadyPresent: result.present,
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
                  isRunningRef.current = false;
                }
              }}
              onProfileChange={(profile, path) => {
                setSelectedProfile(profile);
                setSelectedProfilePath(path);
                updateSettings({ lastSelectedProfile: profile, lastSelectedProfilePath: path });
              }}
              onDismissResult={dismissOverviewResult}
            />
          </div>
        );
        
      case 'capture':
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Capture computer"
              subtitle="Create a reusable setup profile from this computer"
            />
            <Card>
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm text-muted-foreground">
                  This will capture your computer's current setup and save it as a profile.
                  You can later use this profile to configure other machines.
                </p>
                <div>
                  {supportsCapture ? (
                    <Button onClick={handleCapture} disabled={isRunning}>
                      {isRunning ? 'Capturing...' : 'Capture computer'}
                    </Button>
                  ) : (
                    <p className="text-sm text-warning">Capture command not available in this version</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {isRunning && (
              <Card data-testid="activity-card">
                <CardHeader>
                  <CardTitle className="text-base">Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {captureProgress ? (
                        <div>
                          <span className="font-medium">Processing: {captureProgress}</span>
                          {captureStats.processedCount > 0 && (
                            <span className="text-muted-foreground ml-2">({captureStats.processedCount} processed)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Detecting installed applications...</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This may take a moment. Your profile will be saved automatically.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <CaptureResultModal
              open={showCaptureModal}
              onClose={() => setShowCaptureModal(false)}
              onGoToApply={() => setCurrentPage('apply')}
              counts={captureData.counts}
              appsIncluded={captureData.appsIncluded}
              outputPath={captureData.outputPath}
              rawLogs={runLogs}
              rawEnvelope={captureData.rawEnvelope}
            />
            
            {runLogs && (
              <details 
                className="group" 
                open={showTechnicalDetails}
                onToggle={(e) => setShowTechnicalDetails((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Technical details
                </summary>
                <div className="mt-2">
                  <LogViewer
                    logs={runLogs}
                    truncated={logTruncated}
                    onClear={() => setRunLogs('')}
                  />
                </div>
              </details>
            )}

            {/* Last Run - Capture only (per-workflow) */}
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Last Capture Run</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                {lastRunCapture ? (
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Time: </span>
                      <span className="font-medium">
                        {new Date(lastRunCapture.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {lastRunCapture.outcome.succeeded !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Captured: </span>
                        <span className="font-medium text-success">{lastRunCapture.outcome.succeeded}</span>
                      </div>
                    )}
                    {lastRunCapture.outcome.skipped !== undefined && lastRunCapture.outcome.skipped > 0 && (
                      <div>
                        <span className="text-muted-foreground">Skipped: </span>
                        <span className="font-medium">{lastRunCapture.outcome.skipped}</span>
                      </div>
                    )}
                    {lastRunCapture.outcome.failed !== undefined && lastRunCapture.outcome.failed > 0 && (
                      <div>
                        <span className="text-muted-foreground">Failed: </span>
                        <span className="font-medium text-destructive">{lastRunCapture.outcome.failed}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No capture history available</p>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'apply':
        // Derive state from applyData (apply envelope), not verify
        const hasPendingInstalls = applyData.items.filter(i => i.reason === 'would_install').length > 0;
        const hasFailures = applyData.counts.failed > 0;
        const isPreviewReady = checkStep === 'ready';
        
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Set up computer"
              subtitle="Install apps from a saved setup profile"
            />
            
            {/* Row 1: Primary Machine Status Card with CTA */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Setup Profile</CardTitle>
                    <CardDescription className="mt-1">
                      {!selectedProfile ? 'Select a setup profile to begin' : 'Choose a profile to get started'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {/* Primary action button - label changes based on preview toggle */}
                    {!isPreviewReady && (
                      <Button 
                        onClick={settings.dryRunEnabled ? handlePreviewChanges : handleSetupMachine} 
                        disabled={isRunning || !selectedProfile}
                      >
                        {isRunning 
                          ? (settings.dryRunEnabled ? 'Evaluating…' : 'Applying...') 
                          : (settings.dryRunEnabled ? 'Preview changes' : 'Apply setup')
                        }
                      </Button>
                    )}
                    {/* After preview: show apply button if there are pending installs */}
                    {isPreviewReady && hasPendingInstalls && (
                      <Button onClick={handleApplyFromPreview} disabled={isRunning || !selectedProfile}>
                        {isRunning ? 'Applying...' : 'Apply changes'}
                      </Button>
                    )}
                    {/* After preview: done button if nothing to do */}
                    {isPreviewReady && !hasPendingInstalls && !hasFailures && (
                      <Button variant="secondary" onClick={() => setCheckStep('idle')} disabled={isRunning}>
                        Done
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Setup Profile Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Profile</label>
                    <Button 
                      variant="ghost" 
                      onClick={handleImportProfile} 
                      disabled={isRunning}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Add setup...
                    </Button>
                  </div>
                  {profiles.length > 0 ? (
                    <Select
                      value={selectedProfile}
                      onValueChange={(value) => {
                        const selected = profiles.find(p => p.name === value);
                        setSelectedProfile(value);
                        setSelectedProfilePath(selected?.path || '');
                        updateSettings({ lastSelectedProfile: value, lastSelectedProfilePath: selected?.path || '' });
                        setCheckStep('idle');
                        // Reset apply data when profile changes
                        setApplyData({
                          counts: { total: 0, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
                          items: [],
                        });
                      }}
                      disabled={isRunning}
                    >
                      <SelectTrigger data-testid="profile-select" className="w-full h-10">
                        <SelectValue placeholder="-- Select a setup --" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-sm text-warning-foreground">
                      No setups found. Please capture or import a setup first.
                    </div>
                  )}
                </div>

                {/* Dry Run Toggle */}
                <div className="flex items-center space-x-2 pt-2 border-t border-border">
                  <Switch
                    id="dry-run"
                    checked={settings.dryRunEnabled}
                    onCheckedChange={(checked: boolean) => updateSettings({ dryRunEnabled: checked })}
                    disabled={isRunning}
                  />
                  <label htmlFor="dry-run" className="text-sm font-medium cursor-pointer">
                    Preview only — no installs (recommended)
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Activity Log with Technical Details */}
            <ActivityLog
              activities={activities}
              technicalLogs={runLogs}
              logsTruncated={logTruncated}
              onClearLogs={() => setRunLogs('')}
              isComplete={checkStep === 'ready'}
            />

            {/* Last Run - Apply only (per-workflow) */}
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Last Setup Run</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                {lastRunApply ? (
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Time: </span>
                      <span className="font-medium">
                        {new Date(lastRunApply.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {lastRunApply.profile && (
                      <div>
                        <span className="text-muted-foreground">Profile: </span>
                        <span className="font-medium">{lastRunApply.profile}</span>
                      </div>
                    )}
                    {lastRunApply.outcome.installed !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Installed: </span>
                        <span className="font-medium text-success">{lastRunApply.outcome.installed}</span>
                      </div>
                    )}
                    {lastRunApply.outcome.alreadyPresent !== undefined && lastRunApply.outcome.alreadyPresent > 0 && (
                      <div>
                        <span className="text-muted-foreground">Already present: </span>
                        <span className="font-medium">{lastRunApply.outcome.alreadyPresent}</span>
                      </div>
                    )}
                    {lastRunApply.outcome.needsAttention !== undefined && lastRunApply.outcome.needsAttention > 0 && (
                      <div>
                        <span className="text-muted-foreground">Needs attention: </span>
                        <span className="font-medium text-destructive">{lastRunApply.outcome.needsAttention}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No setup history available</p>
                )}
              </CardContent>
            </Card>

            {/* Apply Result Modal - driven by apply envelope data only */}
            <ApplyResultModal
              open={showApplyModal || applyRunPhase === 'applying'}
              onClose={() => {
                setApplyRunPhase('idle');
                setCheckStep('idle');
              }}
              counts={applyData.counts}
              items={applyData.items}
              isDryRun={applyModalIsDryRun}
              isApplying={applyRunPhase === 'applying'}
              currentProgress={applyProgress}
              rawLogs={runLogs}
              rawEnvelope={applyData.rawEnvelope}
              onApplyChanges={hasPendingInstalls ? handleApplyFromPreview : undefined}
            />
          </div>
        );

      case 'verify':
        // Check if we have a recent scan for this profile
        const recentScan = selectedProfilePath ? hasRecentScan(lifecycleState, selectedProfilePath) : false;
        const lastScanTime = lifecycleState.lastPreview?.profilePath === selectedProfilePath 
          ? lifecycleState.lastPreview.timestamp 
          : lifecycleState.lastVerify?.profilePath === selectedProfilePath 
            ? lifecycleState.lastVerify.timestamp 
            : null;
        
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Check computer"
              subtitle="Verify this computer matches your setup profile. No changes will be made."
            />
            
            {/* Profile Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Setup Profile</CardTitle>
                <CardDescription>Select a profile to check against</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profiles.length > 0 ? (
                  <Select
                    value={selectedProfile}
                    onValueChange={(value) => {
                      const selected = profiles.find(p => p.name === value);
                      setSelectedProfile(value);
                      setSelectedProfilePath(selected?.path || '');
                      updateSettings({ lastSelectedProfile: value, lastSelectedProfilePath: selected?.path || '' });
                    }}
                    disabled={isRunning}
                  >
                    <SelectTrigger data-testid="profile-select-verify" className="w-full h-10">
                      <SelectValue placeholder="-- Select a setup --" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-sm text-warning-foreground">
                    No setups found. Please capture or import a setup first.
                  </div>
                )}
                
                {/* Recent scan notice */}
                {recentScan && lastScanTime && selectedProfile && (
                  <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
                    <p className="font-medium">Recent scan available</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Last checked {formatRelativeTime(lastScanTime)}
                    </p>
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {recentScan ? (
                    <>
                      <Button 
                        variant="secondary"
                        onClick={() => setCurrentPage('apply')}
                        disabled={!selectedProfile}
                      >
                        Use existing scan
                      </Button>
                      <Button 
                        onClick={handlePreviewChanges}
                        disabled={isRunning || !selectedProfile}
                      >
                        {isRunning ? 'Checking...' : 'Recheck anyway'}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={handlePreviewChanges}
                      disabled={isRunning || !selectedProfile}
                    >
                      {isRunning ? 'Checking...' : 'Check computer'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Show last verify result if available */}
            {lifecycleState.lastVerify && lifecycleState.lastVerify.profilePath === selectedProfilePath && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Last Check Result</CardTitle>
                  <CardDescription className="text-xs">
                    {formatRelativeTime(lifecycleState.lastVerify.timestamp)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm">
                    {lifecycleState.lastVerify.summary?.alreadyPresent !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Present: </span>
                        <span className="font-medium text-success">{lifecycleState.lastVerify.summary.alreadyPresent}</span>
                      </div>
                    )}
                    {lifecycleState.lastVerify.summary?.missing !== undefined && lifecycleState.lastVerify.summary.missing > 0 && (
                      <div>
                        <span className="text-muted-foreground">Missing: </span>
                        <span className="font-medium text-warning">{lifecycleState.lastVerify.summary.missing}</span>
                      </div>
                    )}
                    {lifecycleState.lastVerify.summary?.failed !== undefined && lifecycleState.lastVerify.summary.failed > 0 && (
                      <div>
                        <span className="text-muted-foreground">Failed: </span>
                        <span className="font-medium text-destructive">{lifecycleState.lastVerify.summary.failed}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
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
        
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Report"
              subtitle="View recent activity and run history"
            />
            
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
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No recent activity</p>
                )}
              </CardContent>
            </Card>
            
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

            <Card>
              <CardHeader>
                <CardTitle>User Interface</CardTitle>
                <CardDescription>Customize your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Show technical details</label>
                    <p className="text-xs text-muted-foreground">
                      Display technical logs, raw output, and advanced debugging information by default
                    </p>
                  </div>
                  <Switch
                    checked={uiMode === 'advanced'}
                    onCheckedChange={(checked) => {
                      const newMode = checked ? 'advanced' : 'default';
                      saveUIMode(newMode);
                      window.location.reload();
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // Build nav indicators from lifecycle state
  const navIndicators: Partial<Record<'capture' | 'apply' | 'verify' | 'report', { type: 'success' | 'warning' | 'info' | 'activity'; tooltip?: string }>> = {};
  
  // Show activity indicator when running
  if (isRunning) {
    if (currentPage === 'capture') {
      navIndicators.capture = { type: 'activity', tooltip: 'Capturing...' };
    } else if (currentPage === 'apply') {
      navIndicators.apply = { type: 'activity', tooltip: 'Running...' };
    } else if (currentPage === 'verify') {
      navIndicators.verify = { type: 'activity', tooltip: 'Checking...' };
    }
  }
  
  // Show success/warning indicators based on recent lifecycle events
  if (!isRunning && lifecycleState.lastApply) {
    const timeSinceApply = Date.now() - new Date(lifecycleState.lastApply.timestamp).getTime();
    if (timeSinceApply < 5 * 60 * 1000) { // Within 5 minutes
      navIndicators.apply = lifecycleState.lastApply.summary?.failed 
        ? { type: 'warning', tooltip: 'Completed with issues' }
        : { type: 'success', tooltip: 'Setup complete' };
    }
  }
  
  if (!isRunning && lifecycleState.lastCapture) {
    const timeSinceCapture = Date.now() - new Date(lifecycleState.lastCapture.timestamp).getTime();
    if (timeSinceCapture < 5 * 60 * 1000) {
      navIndicators.capture = { type: 'success', tooltip: 'Profile captured' };
    }
  }

  // Generate page title based on current page
  const getPageTitle = () => {
    switch (currentPage) {
      case 'overview': return '';
      case 'capture': return 'Capture computer';
      case 'apply': return 'Set up computer';
      case 'verify': return 'Check computer';
      case 'report': return 'Report';
      case 'settings': return 'Settings';
      default: return '';
    }
  };

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        pageTitle={getPageTitle()}
        navIndicators={navIndicators}
        uiMode={uiMode}
        onToggleUIMode={handleToggleUIMode}
        previousPage={previousPage}
        onBack={handleBack}
      >
        {renderPage()}
      </AppShell>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={setCurrentPage}
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
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(folderPathForModal);
                }}
                aria-label="Copy path"
              >
                <Copy className="h-4 w-4" />
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
          <div className="py-4">
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
              {deleteProfilePath === selectedProfilePath ? (
                <span className="text-warning">
                  You can't delete the profile currently in use. Select a different profile first.
                </span>
              ) : (
                <>Are you sure you want to delete "{deleteProfileName || 'this profile'}"? This action cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowDeleteProfileModal(false)}>
              {deleteProfilePath === selectedProfilePath ? 'Close' : 'Cancel'}
            </Button>
            {deleteProfilePath !== selectedProfilePath && (
              <Button variant="danger" onClick={handleDeleteProfile}>
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default App;
