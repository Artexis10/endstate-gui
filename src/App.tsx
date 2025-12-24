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
import { parseApplyProgressLine, StreamingLineBuffer } from './lib/apply-utils';
import { saveLastRun, loadLastRunForCommand, migrateLegacyLastRun, type LastRunData } from './lib/last-run';
import { loadLifecycleState, recordLifecycleEvent, hasRecentScan, formatRelativeTime, type LifecycleState, type LifecycleEvent } from './lib/lifecycle-state';
import { loadUIMode, saveUIMode, toggleUIMode, type UIMode } from './lib/ui-mode';
import { OverviewScreen } from './components/app/overview-screen';
import { getProfilesDirectory, ensureDirectory, isTauriRuntime } from './lib/tauri-bridge';
import { runEndstateOnce, getErrorMessage } from './lib/engine-exec';
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
  const [uiMode, setUIMode] = useState<UIMode>(loadUIMode());
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [profiles, setProfiles] = useState<DiscoveredProfile[]>([]);
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
      const discovered = await discoverProfiles(dir);
      setProfiles(discovered);
    }
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
              isRunning={isRunning}
              onNavigate={setCurrentPage}
              onCapture={handleCapture}
              onSetup={() => {
                setCurrentPage('apply');
                if (settings.dryRunEnabled) {
                  handlePreviewChanges();
                }
              }}
              onCheck={() => {
                setCurrentPage('verify');
                handlePreviewChanges();
              }}
              onProfileChange={(profile, path) => {
                setSelectedProfile(profile);
                setSelectedProfilePath(path);
                updateSettings({ lastSelectedProfile: profile, lastSelectedProfilePath: path });
              }}
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
              <Card>
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
                          ? (settings.dryRunEnabled ? 'Previewing...' : 'Applying...') 
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
                    <select
                      value={selectedProfile}
                      onChange={(e) => {
                        const selected = profiles.find(p => p.name === e.target.value);
                        setSelectedProfile(e.target.value);
                        setSelectedProfilePath(selected?.path || '');
                        updateSettings({ lastSelectedProfile: e.target.value, lastSelectedProfilePath: selected?.path || '' });
                        setCheckStep('idle');
                        // Reset apply data when profile changes
                        setApplyData({
                          counts: { total: 0, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
                          items: [],
                        });
                      }}
                      disabled={isRunning}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">-- Select a setup --</option>
                      {profiles.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
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
                  <select
                    value={selectedProfile}
                    onChange={(e) => {
                      const selected = profiles.find(p => p.name === e.target.value);
                      setSelectedProfile(e.target.value);
                      setSelectedProfilePath(selected?.path || '');
                      updateSettings({ lastSelectedProfile: e.target.value, lastSelectedProfilePath: selected?.path || '' });
                    }}
                    disabled={isRunning}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Select a setup --</option>
                    {profiles.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
                                      {run.mode === 'preview' ? 'Would install: ' : 'Installed: '}
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
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.engineMode === 'path'}
                      onChange={() => updateSettings({ engineMode: 'path' })}
                      className="rounded"
                    />
                    <span className="text-sm">Use endstate from PATH</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.engineMode === 'script'}
                      onChange={() => updateSettings({ engineMode: 'script' })}
                      className="rounded"
                    />
                    <span className="text-sm">Use endstate script path</span>
                  </label>
                </div>

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
      >
        {renderPage()}
      </AppShell>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={setCurrentPage}
      />
    </>
  );
}

export default App;
