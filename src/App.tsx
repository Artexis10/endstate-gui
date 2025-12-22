import { useEffect, useState, useRef } from 'react';
import {
  AutosuiteEnvelope,
  AutosuiteCapabilitiesData,
  AutosuiteVerifyData,
  AutosuiteReportData,
  AutosuiteApplyData,
} from './types';
import { AppSettings, loadSettings, saveSettings } from './settings';
import { discoverProfiles, DiscoveredProfile } from './file-discovery';
import { runAutosuiteStreaming, StreamEvent } from './streaming-runner';
import { LogBuffer } from './log-buffer';
import { AppShell } from './components/layout/app-shell';
import { CommandPalette } from './components/layout/command-palette';
import { PageHeader } from './components/app/page-header';
import { LogViewer } from './components/app/log-viewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Switch } from './components/ui/switch';
import { StatusPill } from './components/app/status-pill';
import { Loader2 } from 'lucide-react';

type AppStatus = 'loading' | 'ready' | 'error';
type PageType = 'capture' | 'apply' | 'verify' | 'report' | 'settings';

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
  const [lastAction, setLastAction] = useState<string | null>(null);
  const logBufferRef = useRef<LogBuffer | null>(null);

  const loadProfilesDirectory = async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      const dir = settings.customProfilesDirectory || await invoke<string>('get_default_profiles_directory');
      return dir;
    } catch (err) {
      console.error('Failed to get profiles directory:', err);
      return '';
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
      setRunLogs(logs);
      setLogTruncated(truncated);
    });

    try {
      const capResult = await runAutosuiteStreaming<AutosuiteCapabilitiesData>(
        settings,
        'capabilities',
        [],
        (event) => {
          if (event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
          }
        }
      );
      logBufferRef.current?.flush();

      if (!capResult.envelope) {
        setState({
          status: 'error',
          errorMessage: 'Autosuite engine not reachable',
          errorStderr: capResult.stderr || 'STDOUT was not valid JSON',
          errorCommand: 'autosuite capabilities --json',
          capabilities: null,
          report: null,
          verify: null,
        });
        return;
      }

      const reportResult = await runAutosuiteStreaming<AutosuiteReportData>(
        settings,
        'report',
        [],
        () => {}
      );

      let verifyResult: AutosuiteEnvelope<AutosuiteVerifyData> | null = null;
      if (selectedProfile && profiles.length > 0) {
        const result = await runAutosuiteStreaming<AutosuiteVerifyData>(
          settings,
          'verify',
          ['--profile', selectedProfile],
          () => {}
        );
        verifyResult = result.envelope;
      }

      setState({
        status: 'ready',
        errorMessage: null,
        errorStderr: null,
        errorCommand: null,
        capabilities: capResult.envelope,
        report: reportResult.envelope,
        verify: verifyResult,
      });
    } catch (err) {
      setState({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStderr: null,
        errorCommand: 'autosuite capabilities --json',
        capabilities: null,
        report: null,
        verify: null,
      });
    }
  };

  useEffect(() => {
    if (settings.engineMode && (settings.engineMode === 'path' || settings.engineScriptPath)) {
      loadInitialData();
    }
  }, [settings.engineMode, settings.engineScriptPath]);

  const handleCheckSetup = async () => {
    if (!selectedProfile) {
      alert('Please select a setup');
      return;
    }

    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(logs);
      setLogTruncated(truncated);
    });

    try {
      const verifyResult = await runAutosuiteStreaming<AutosuiteVerifyData>(
        settings,
        'verify',
        ['--profile', selectedProfilePath],
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
          }
        }
      );

      setState((prev) => ({
        ...prev,
        verify: verifyResult.envelope,
      }));

      setLastAction(`Check setup at ${new Date().toLocaleTimeString()}`);

      const reportResult = await runAutosuiteStreaming<AutosuiteReportData>(
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
      alert(`Failed to run verify: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      setIsRunning(false);
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
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(logs);
      setLogTruncated(truncated);
    });

    try {
      const args = ['--profile', selectedProfilePath];
      if (settings.dryRunEnabled) {
        args.push('--dry-run');
      }

      const applyResult = await runAutosuiteStreaming<AutosuiteApplyData>(
        settings,
        'apply',
        args,
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
          }
        }
      );

      if (applyResult.envelope) {
        const dryRunText = settings.dryRunEnabled ? ' (dry run)' : '';
        if (applyResult.envelope.success) {
          alert(`Setup completed successfully${dryRunText}!`);
        } else {
          const friendlyMsg = applyResult.envelope.error?.message || 
                             'Autosuite couldn\'t apply the setup. Please try again.';
          alert(`Couldn't apply setup\n\n${friendlyMsg}`);
        }
      }

      setLastAction(`Set up machine at ${new Date().toLocaleTimeString()}`);

      const reportResult = await runAutosuiteStreaming<AutosuiteReportData>(
        settings,
        'report',
        [],
        () => {}
      );
      setState((prev) => ({
        ...prev,
        report: reportResult.envelope,
      }));

      const verifyResult = await runAutosuiteStreaming<AutosuiteVerifyData>(
        settings,
        'verify',
        ['--profile', selectedProfilePath],
        () => {}
      );
      setState((prev) => ({
        ...prev,
        verify: verifyResult.envelope,
      }));
    } catch (err) {
      alert(`Failed to run apply: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      setIsRunning(false);
    }
  };

  const handleCapture = async () => {
    setIsRunning(true);
    setRunLogs('');
    setLogTruncated(false);
    logBufferRef.current = new LogBuffer((logs, truncated) => {
      setRunLogs(logs);
      setLogTruncated(truncated);
    });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      const dir = await loadProfilesDirectory();
      if (!dir) {
        alert('Failed to determine profiles directory');
        return;
      }
      
      try {
        await invoke('ensure_dir', { path: dir });
      } catch (err) {
        alert(`Failed to create output directory: ${err}`);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const filename = `setup_${timestamp}.jsonc`;
      const outputPath = `${dir}\\${filename}`;

      const captureResult = await runAutosuiteStreaming(
        settings,
        'capture',
        ['--out', outputPath],
        (event: StreamEvent) => {
          if (event.type === 'stdout' || event.type === 'stderr') {
            logBufferRef.current?.append(event.data);
          }
        }
      );

      const isSuccess = captureResult.envelope?.success ?? (captureResult.exitCode === 0);
      
      if (isSuccess) {
        alert('Setup scanned successfully!');
        await refreshProfiles();
        
        const discovered = await discoverProfiles(dir);
        if (discovered.length > 0) {
          const newest = discovered.sort((a, b) => b.path.localeCompare(a.path))[0];
          setSelectedProfile(newest.name);
          setSelectedProfilePath(newest.path);
          updateSettings({ lastSelectedProfile: newest.name, lastSelectedProfilePath: newest.path });
        }
      } else {
        const friendlyMsg = captureResult.envelope?.error?.message || 
                           'Autosuite couldn\'t save the setup. Please try again.';
        alert(`Couldn't scan this computer\n\n${friendlyMsg}`);
      }

      setLastAction(`Scanned at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      alert(`Failed to scan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      logBufferRef.current?.flush();
      setIsRunning(false);
    }
  };

  const handleImportProfile = async () => {
    const { invoke } = await import('@tauri-apps/api/core');

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

  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-2xl border-danger">
          <CardHeader>
            <CardTitle className="text-danger">Autosuite engine not reachable</CardTitle>
            <CardDescription>Unable to connect to the autosuite engine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.errorMessage && (
              <div>
                <h3 className="text-sm font-medium mb-2">Error</h3>
                <p className="text-sm text-danger">{state.errorMessage}</p>
              </div>
            )}
            {state.errorStderr && (
              <div>
                <h3 className="text-sm font-medium mb-2">STDERR</h3>
                <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-40">{state.errorStderr}</pre>
              </div>
            )}
            {state.errorCommand && (
              <div>
                <h3 className="text-sm font-medium mb-2">Command attempted</h3>
                <code className="text-xs bg-background p-2 rounded border block">{state.errorCommand}</code>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button variant="secondary" onClick={() => setCurrentPage('settings')}>
                Open Settings
              </Button>
              <Button variant="ghost" onClick={resetSettings}>
                Reset Settings
              </Button>
              <Button onClick={loadInitialData}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'capture':
        return (
          <div className="space-y-6">
            <PageHeader
              title="Capture"
              subtitle="Scan this computer to create a setup profile"
            />
            <Card>
              <CardHeader>
                <CardTitle>Scan Current Machine</CardTitle>
                <CardDescription>
                  Create a snapshot of installed applications and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will scan your computer and save the current setup as a profile.
                  You can later use this profile to set up other machines.
                </p>
                <div className="flex gap-2">
                  {supportsCapture ? (
                    <Button onClick={handleCapture} disabled={isRunning}>
                      {isRunning ? 'Scanning...' : 'Scan this machine'}
                    </Button>
                  ) : (
                    <p className="text-sm text-warning">Capture command not available in this version</p>
                  )}
                  <Button variant="secondary" onClick={handleImportProfile} disabled={isRunning}>
                    Import existing setup
                  </Button>
                </div>
              </CardContent>
            </Card>
            {runLogs && (
              <LogViewer
                logs={runLogs}
                truncated={logTruncated}
                onClear={() => setRunLogs('')}
              />
            )}
          </div>
        );

      case 'apply':
        return (
          <div className="space-y-6">
            <PageHeader
              title="Apply"
              subtitle="Set up this machine using a saved profile"
              actions={
                <Button onClick={handleSetupMachine} disabled={isRunning || !selectedProfile}>
                  {isRunning ? 'Running...' : 'Fix missing apps'}
                </Button>
              }
            />
            
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Engine Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CLI Version</span>
                    <span className="text-sm font-medium">{state.capabilities?.cliVersion || 'unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Schema</span>
                    <span className="text-sm font-medium">{state.capabilities?.schemaVersion || 'unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusPill status={state.capabilities?.success ? 'ok' : 'error'} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Machine Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {state.verify?.success ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">OK</span>
                        <span className="text-sm font-medium">{state.verify.data?.summary?.okCount ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Missing</span>
                        <span className="text-sm font-medium">{state.verify.data?.summary?.missingCount ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mismatch</span>
                        <span className="text-sm font-medium">{state.verify.data?.summary?.versionMismatchCount ?? 0}</span>
                      </div>
                    </>
                  ) : state.verify ? (
                    <p className="text-sm text-danger">{state.verify.error?.message || 'Verification failed'}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Run "Check setup" to see status</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Last Run</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {state.report?.data?.hasState ? (
                    <>
                      {state.report.data.lastApplied && (
                        <div>
                          <p className="text-xs text-muted-foreground">Last Applied</p>
                          <p className="text-sm font-medium">
                            {new Date(state.report.data.lastApplied.timestamp).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {state.report.data.lastVerify && (
                        <div>
                          <p className="text-xs text-muted-foreground">Last Verify</p>
                          <p className="text-sm font-medium">
                            {new Date(state.report.data.lastVerify.timestamp).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No state available</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Setup Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Setup Profile</label>
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
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="dry-run"
                    checked={settings.dryRunEnabled}
                    onCheckedChange={(checked: boolean) => updateSettings({ dryRunEnabled: checked })}
                    disabled={isRunning}
                  />
                  <label htmlFor="dry-run" className="text-sm font-medium cursor-pointer">
                    Preview changes (recommended)
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSetupMachine} disabled={isRunning || !selectedProfile}>
                    {isRunning ? 'Running...' : 'Fix missing apps'}
                  </Button>
                  <Button variant="secondary" onClick={handleCheckSetup} disabled={isRunning || !selectedProfile}>
                    Check this computer
                  </Button>
                </div>

                {lastAction && (
                  <p className="text-xs text-muted-foreground">Last action: {lastAction}</p>
                )}
              </CardContent>
            </Card>

            {runLogs && (
              <LogViewer
                logs={runLogs}
                truncated={logTruncated}
                onClear={() => setRunLogs('')}
              />
            )}
          </div>
        );

      case 'verify':
      case 'report':
        return (
          <div className="space-y-6">
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
