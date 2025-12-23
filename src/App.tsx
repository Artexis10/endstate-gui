import { useEffect, useState, useRef } from 'react';
import {
  AutosuiteEnvelope,
  AutosuiteCapabilitiesData,
  AutosuiteVerifyData,
  AutosuiteReportData,
  AutosuiteApplyData,
  AutosuiteCaptureData,
  CapturedApp,
  CaptureCounts,
  AutosuiteApplyResultData,
} from './types';
import { AppSettings, loadSettings, saveSettings } from './settings';
import { discoverProfiles, DiscoveredProfile } from './file-discovery';
import { StreamEvent } from './streaming-runner';
import { runEngineStreaming } from './lib/engine';
import { LogBuffer } from './log-buffer';
import { parseCaptureOutput, type CaptureStats } from './lib/log-parse';
import { parseApplyProgressLine, StreamingLineBuffer } from './lib/apply-utils';
import { saveLastRun, loadLastRun, type LastRunData } from './lib/last-run';
import { getProfilesDirectory, ensureDirectory, isTauriRuntime } from './lib/tauri-bridge';
import { runAutosuiteOnce, getErrorMessage } from './lib/engine-exec';
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
type PageType = 'capture' | 'apply' | 'verify' | 'report' | 'settings';
type CheckStep = 'idle' | 'scanning' | 'comparing' | 'ready';

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
  capabilities: AutosuiteEnvelope<AutosuiteCapabilitiesData> | null;
  report: AutosuiteEnvelope<AutosuiteReportData> | null;
  verify: AutosuiteEnvelope<AutosuiteVerifyData> | null;
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [currentPage, setCurrentPage] = useState<PageType>('apply');
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
  const [, setLastRun] = useState<LastRunData | null>(null);
  const [safeMode, setSafeMode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const logBufferRef = useRef<LogBuffer | null>(null);
  
  // Apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyModalIsDryRun, setApplyModalIsDryRun] = useState(true);  // Track if modal shows preview or apply result
  const [applyData, setApplyData] = useState<{ counts: ApplyCounts; items: ApplyItem[]; rawEnvelope?: object }>({
    counts: { total: 0, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 },
    items: [],
  });
  const [applyProgress, setApplyProgress] = useState<{ currentApp: string; action: string }>({ currentApp: '', action: '' });

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
    
    const savedLastRun = loadLastRun();
    if (savedLastRun) {
      setLastRun(savedLastRun);
    }
    
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
    localStorage.removeItem('autosuite-gui-settings');
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
    const capResult = await runAutosuiteOnce<AutosuiteEnvelope<AutosuiteCapabilitiesData>>(
      settings,
      'capabilities',
      []
    );

    if (!capResult.success) {
      setState({
        status: 'error',
        errorMessage: getErrorMessage(capResult.error),
        errorStderr: capResult.stderr || null,
        errorCommand: capResult.error.command || 'autosuite capabilities --json',
        capabilities: null,
        report: null,
        verify: null,
      });
      return;
    }

    // Capabilities succeeded - continue with report (also non-streaming)
    const reportResult = await runAutosuiteOnce<AutosuiteEnvelope<AutosuiteReportData>>(
      settings,
      'report',
      []
    );

    let verifyResult: AutosuiteEnvelope<AutosuiteVerifyData> | null = null;
    if (selectedProfile && profiles.length > 0) {
      const result = await runAutosuiteOnce<AutosuiteEnvelope<AutosuiteVerifyData>>(
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
      const applyResult = await runEngineStreaming<AutosuiteApplyData>(
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
        const envelopeData = applyResult.envelope.data as AutosuiteApplyResultData | undefined;
        
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
      setApplyModalIsDryRun(true);  // Preview = dry-run
      setShowApplyModal(true);
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

      const applyResult = await runEngineStreaming<AutosuiteApplyData>(
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
        const envelopeData = applyResult.envelope.data as AutosuiteApplyResultData | undefined;
        
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
        setApplyModalIsDryRun(false);  // Apply = not dry-run
        setShowApplyModal(true);
      }

      // Refresh report state
      const reportResult = await runEngineStreaming<AutosuiteReportData>(
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
        const envelopeData = captureResult.envelope?.data as AutosuiteCaptureData | undefined;
        
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
        
        // Save Last Run
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
        setLastRun(lastRunData);
        
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
                           'Autosuite couldn\'t save the setup. Please try again.';
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
            <CardTitle>Welcome to Autosuite GUI</CardTitle>
            <CardDescription>Please configure your autosuite engine to get started.</CardDescription>
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
              <p className="text-sm text-muted-foreground mt-1">Running: autosuite capabilities --json</p>
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
                {state.errorMessage || 'Unable to connect to the autosuite engine'}
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
      case 'capture':
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Capture machine"
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
                      {isRunning ? 'Capturing...' : 'Capture machine'}
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
              title="Apply"
              subtitle="Set up this machine using a saved profile"
            />
            
            {/* Row 1: Primary Machine Status Card with CTA */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Setup Profile</CardTitle>
                    <CardDescription className="mt-1">
                      {!selectedProfile && 'Select a setup profile to begin'}
                      {selectedProfile && checkStep === 'idle' && !isRunning && 'Ready to preview changes'}
                      {selectedProfile && isRunning && applyProgress.currentApp && (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {applyProgress.action}: <span className="font-mono">{applyProgress.currentApp}</span>
                        </span>
                      )}
                      {selectedProfile && isRunning && !applyProgress.currentApp && 'Analyzing...'}
                      {checkStep === 'scanning' && 'Analyzing setup profile...'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {isPreviewReady && hasPendingInstalls && (
                      <Button onClick={handleSetupMachine} disabled={isRunning || !selectedProfile}>
                        {isRunning ? 'Installing...' : 'Apply changes'}
                      </Button>
                    )}
                    {!isPreviewReady && (
                      <Button onClick={handlePreviewChanges} disabled={isRunning || !selectedProfile}>
                        {isRunning ? 'Analyzing...' : 'Preview changes'}
                      </Button>
                    )}
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
                    Preview changes only (recommended)
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

            {/* Last Run (reference only, de-emphasized at bottom) */}
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Last Run</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                {state.report?.data?.hasState ? (
                  <div className="flex gap-6 text-xs">
                    {state.report.data.lastApplied && (
                      <div>
                        <span className="text-muted-foreground">Last Applied: </span>
                        <span className="font-medium">
                          {new Date(state.report.data.lastApplied.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No history available</p>
                )}
              </CardContent>
            </Card>

            {/* Apply Result Modal - driven by apply envelope data only */}
            <ApplyResultModal
              open={showApplyModal}
              onClose={() => {
                setShowApplyModal(false);
                setCheckStep('idle');
              }}
              counts={applyData.counts}
              items={applyData.items}
              isDryRun={applyModalIsDryRun}
              rawLogs={runLogs}
              rawEnvelope={applyData.rawEnvelope}
              onApplyChanges={hasPendingInstalls ? handleSetupMachine : undefined}
            />
          </div>
        );

      case 'verify':
      case 'report':
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title={currentPage === 'verify' ? 'Verify' : 'Report'}
              subtitle={currentPage === 'verify' ? 'Check machine status' : 'View history and state'}
            />
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  This page is under construction. Use the Apply page for now.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            {errorBanner}
            <PageHeader
              title="Settings"
              subtitle="Configure autosuite engine and preferences"
            />
            <Card>
              <CardHeader>
                <CardTitle>Engine Configuration</CardTitle>
                <CardDescription>Choose how to run the autosuite engine</CardDescription>
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
                    <span className="text-sm">Use autosuite from PATH</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.engineMode === 'script'}
                      onChange={() => updateSettings({ engineMode: 'script' })}
                      className="rounded"
                    />
                    <span className="text-sm">Use autosuite script path</span>
                  </label>
                </div>

                {settings.engineMode === 'script' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Script Path</label>
                    <Input
                      type="text"
                      value={settings.engineScriptPath}
                      onChange={(e) => updateSettings({ engineScriptPath: e.target.value })}
                      placeholder="C:\path\to\autosuite.ps1"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Storage Directory (optional)</label>
                  <Input
                    type="text"
                    value={settings.customProfilesDirectory}
                    onChange={(e) => updateSettings({ customProfilesDirectory: e.target.value })}
                    placeholder="Leave empty to use default: Documents\Autosuite\Setups"
                  />
                  <p className="text-xs text-muted-foreground">
                    By default, setups are stored in Documents\Autosuite\Setups
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

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        pageTitle={currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
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
