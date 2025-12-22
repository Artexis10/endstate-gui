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
import { stripAnsi } from './utils';
import { LogBuffer } from './log-buffer';
import './App.css';

type AppStatus = 'loading' | 'ready' | 'error';

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
  const [showSettings, setShowSettings] = useState(false);
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
    logBufferRef.current = new LogBuffer((logs) => setRunLogs(logs));

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
    logBufferRef.current = new LogBuffer((logs) => setRunLogs(logs));

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
      logBufferRef.current?.flush();

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
    logBufferRef.current = new LogBuffer((logs) => setRunLogs(logs));

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
      logBufferRef.current?.flush();

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
      setIsRunning(false);
    }
  };

  const handleRefresh = async () => {
    setIsRunning(true);
    setRunLogs('');
    logBufferRef.current = new LogBuffer((logs) => setRunLogs(logs));

    try {
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

      if (selectedProfile) {
        const verifyResult = await runAutosuiteStreaming<AutosuiteVerifyData>(
          settings,
          'verify',
          ['--profile', selectedProfile],
          () => {}
        );
        setState((prev) => ({
          ...prev,
          verify: verifyResult.envelope,
        }));
      }

      setLastAction(`Refreshed at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      alert(`Failed to refresh: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCapture = async () => {
    setIsRunning(true);
    setRunLogs('');
    logBufferRef.current = new LogBuffer((logs) => setRunLogs(logs));

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      const dir = await loadProfilesDirectory();
      if (!dir) {
        alert('Failed to determine profiles directory');
        return;
      }
      
      // Ensure the output directory exists before running capture
      try {
        await invoke('ensure_dir', { path: dir });
      } catch (err) {
        alert(`Failed to create output directory: ${err}`);
        return;
      }

      // Generate timestamped filename
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
      logBufferRef.current?.flush();

      // Handle success/failure based on envelope or exit code
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
        // Show friendly error message
        const friendlyMsg = captureResult.envelope?.error?.message || 
                           'Autosuite couldn\'t save the setup. Please try again.';
        
        const technicalDetails = [
          `Exit code: ${captureResult.exitCode}`,
          captureResult.stderr ? `Stderr: ${stripAnsi(captureResult.stderr).slice(-2000)}` : null,
          captureResult.envelope ? `Envelope: ${JSON.stringify(captureResult.envelope, null, 2)}` : null
        ].filter(Boolean).join('\n\n');
        
        if (confirm(`Couldn't scan this computer\n\n${friendlyMsg}\n\nShow technical details?`)) {
          alert(`Technical Details:\n\n${technicalDetails}`);
        }
      }

      setLastAction(`Scanned at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      alert(`Failed to scan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
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

  if (!settings.engineMode || (settings.engineMode === 'script' && !settings.engineScriptPath)) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Autosuite</h1>
        </header>
        <main className="app-main">
          <div className="welcome-screen">
            <h2>Welcome to Autosuite GUI</h2>
            <p>Please configure your autosuite engine to get started.</p>
            <button className="action-button primary" onClick={() => setShowSettings(true)}>
              Open Settings
            </button>
          </div>
        </main>
      </div>
    );
  }

  const supportsCapture = Array.isArray(state.capabilities?.data?.commands) && state.capabilities.data.commands.includes('capture');

  if (state.status === 'loading') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Autosuite</h1>
          <button className="settings-button" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </header>
        <main className="app-main">
          <div className="status-card status-checking">
            <div className="status-icon">⏳</div>
            <div className="status-text">
              <h2>Loading...</h2>
              <p>Running: autosuite capabilities --json</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Autosuite</h1>
          <button className="settings-button" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </header>
        <main className="app-main">
          <div className="error-screen">
            <div className="error-icon">✗</div>
            <h2>Autosuite engine not reachable</h2>
            <div className="error-details">
              <div className="error-section">
                <h3>Error</h3>
                <p>{state.errorMessage}</p>
              </div>
              {state.errorStderr && (
                <div className="error-section">
                  <h3>STDERR</h3>
                  <pre>{state.errorStderr}</pre>
                </div>
              )}
              {state.errorCommand && (
                <div className="error-section">
                  <h3>Command attempted</h3>
                  <code>{state.errorCommand}</code>
                </div>
              )}
            </div>
            <div className="error-actions">
              <button className="action-button secondary" onClick={() => setShowSettings(true)}>
                Open Settings
              </button>
              <button className="action-button tertiary" onClick={resetSettings}>
                Reset Settings
              </button>
              <button className="action-button primary" onClick={loadInitialData}>
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (profiles.length === 0 && state.status === 'ready') {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Autosuite</h1>
          <button className="settings-button" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </header>
        <main className="app-main">
          {showSettings && (
            <SettingsModal
              settings={settings}
              onSave={(newSettings) => {
                updateSettings(newSettings);
                setShowSettings(false);
              }}
              onClose={() => setShowSettings(false)}
            />
          )}
          <div className="welcome-screen">
            <h2>No setup saved yet</h2>
            <p>Scan this computer to save how it's set up — or use a setup from another machine.</p>
            <div className="empty-state-actions">
              {supportsCapture && (
                <button className="action-button primary" onClick={handleCapture} disabled={isRunning}>
                  Scan this machine
                </button>
              )}
              <button className="action-button secondary" onClick={handleImportProfile} disabled={isRunning}>
                Use an existing setup
              </button>
            </div>
            {isRunning && runLogs && (
              <div className="logs-panel">
                <h3>Logs</h3>
                <pre className="logs-content">{runLogs}</pre>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Autosuite</h1>
        <button className="settings-button" onClick={() => setShowSettings(true)}>
          ⚙️ Settings
        </button>
      </header>
      <main className="app-main">
        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={(newSettings) => {
              updateSettings(newSettings);
              setShowSettings(false);
            }}
            onClose={() => setShowSettings(false)}
          />
        )}

        <div className="cards-grid">
          <InfoCard
            title="Autosuite engine"
            status={state.capabilities?.success ? 'ok' : 'error'}
            data={state.capabilities}
          >
            <div className="card-content">
              <p>
                <strong>CLI Version:</strong> {state.capabilities?.cliVersion || 'unknown'}
              </p>
              <p>
                <strong>Schema Version:</strong> {state.capabilities?.schemaVersion || 'unknown'}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                {state.capabilities?.success ? (
                  <span className="status-ok">OK</span>
                ) : (
                  <span className="status-error">Error</span>
                )}
              </p>
            </div>
          </InfoCard>

          <InfoCard
            title="Machine status"
            status={state.verify?.success ? 'ok' : state.verify ? 'error' : 'neutral'}
            data={state.verify}
          >
            <div className="card-content">
              {state.verify ? (
                state.verify.success ? (
                  <>
                    <p>
                      <strong>OK:</strong> {state.verify.data?.summary?.okCount ?? 0}
                    </p>
                    <p>
                      <strong>Missing:</strong> {state.verify.data?.summary?.missingCount ?? 0}
                    </p>
                    <p>
                      <strong>Version Mismatch:</strong>{' '}
                      {state.verify.data?.summary?.versionMismatchCount ?? 0}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="error-text">
                      <strong>Error:</strong> {state.verify.error?.message || 'Verification failed. Please check the logs for details.'}
                    </p>
                    <p className="error-code">
                      <strong>Code:</strong> {state.verify.error?.code || 'N/A'}
                    </p>
                  </>
                )
              ) : (
                <p className="neutral-text">Run "Check setup" to see machine status</p>
              )}
            </div>
          </InfoCard>

          <InfoCard
            title="Last run / history"
            status={state.report?.data?.hasState ? 'ok' : 'neutral'}
            data={state.report}
          >
            <div className="card-content">
              {state.report?.data?.hasState ? (
                <>
                  {state.report.data.lastApplied && (
                    <div className="history-item">
                      <p>
                        <strong>Last Applied:</strong>{' '}
                        {new Date(state.report.data.lastApplied.timestamp).toLocaleString()}
                      </p>
                      <p className="history-detail">
                        Manifest: {state.report.data.lastApplied.manifestPath}
                      </p>
                    </div>
                  )}
                  {state.report.data.lastVerify && (
                    <div className="history-item">
                      <p>
                        <strong>Last Verify:</strong>{' '}
                        {new Date(state.report.data.lastVerify.timestamp).toLocaleString()}
                      </p>
                      <p className="history-detail">
                        Missing: {state.report.data.lastVerify.missingCount ?? 0}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="neutral-text">No state available</p>
              )}
            </div>
          </InfoCard>
        </div>

        <div className="actions-panel">
          <div className="profile-selector-group">
            <label htmlFor="profile-select">Setup:</label>
            {profiles.length > 0 ? (
              <select
                id="profile-select"
                value={selectedProfile}
                onChange={(e) => {
                  const selected = profiles.find(p => p.name === e.target.value);
                  setSelectedProfile(e.target.value);
                  setSelectedProfilePath(selected?.path || '');
                  updateSettings({ lastSelectedProfile: e.target.value, lastSelectedProfilePath: selected?.path || '' });
                }}
                disabled={isRunning}
              >
                <option value="">-- Select a setup --</option>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="no-profiles-hint">
                No setups found.
              </div>
            )}
          </div>

          <div className="dry-run-toggle">
            <label>
              <input
                type="checkbox"
                checked={settings.dryRunEnabled}
                onChange={(e) => updateSettings({ dryRunEnabled: e.target.checked })}
                disabled={isRunning}
              />
              <span>Preview changes (recommended)</span>
            </label>
          </div>

          <div className="actions-buttons">
            <button
              className="action-button primary"
              onClick={handleSetupMachine}
              disabled={isRunning || !selectedProfile}
            >
              {isRunning ? 'Running...' : 'Fix missing apps'}
            </button>
            <button
              className="action-button secondary"
              onClick={handleCheckSetup}
              disabled={isRunning || !selectedProfile}
            >
              Check this computer
            </button>
            <button className="action-button tertiary" onClick={handleRefresh} disabled={isRunning}>
              Refresh
            </button>
          </div>

          {lastAction && <div className="last-action">Last action: {lastAction}</div>}
        </div>

        {runLogs && (
          <div className="logs-panel">
            <h3>Run Output</h3>
            <pre className="logs-content">{runLogs}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

interface InfoCardProps {
  title: string;
  status: 'ok' | 'error' | 'neutral';
  data: AutosuiteEnvelope<any> | null;
  children: React.ReactNode;
}

function InfoCard({ title, status, data, children }: InfoCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`info-card info-card-${status}`}>
      <div className="info-card-header">
        <h3>{title}</h3>
        <div className="info-card-icon">
          {status === 'ok' && '✓'}
          {status === 'error' && '✗'}
          {status === 'neutral' && '○'}
        </div>
      </div>
      {children}
      {data && (
        <div className="json-details">
          <button className="json-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▼' : '▶'} View details (JSON)
          </button>
          {expanded && (
            <pre className="json-content">{JSON.stringify(data, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const validateSettings = async () => {
    setIsValidating(true);
    setValidationStatus('checking');
    setValidationMessage('Validating...');

    try {
      if (localSettings.engineMode === 'script') {
        const scriptPath = localSettings.engineScriptPath.trim();
        
        if (!scriptPath) {
          setValidationStatus('invalid');
          setValidationMessage('Script path is required');
          setIsValidating(false);
          return;
        }

        if (!scriptPath.toLowerCase().endsWith('.ps1')) {
          setValidationStatus('invalid');
          setValidationMessage('Script path must end with .ps1');
          setIsValidating(false);
          return;
        }

        const { invoke } = await import('@tauri-apps/api/core');
        const exists = await invoke<boolean>('check_file_exists', { path: scriptPath });
        
        if (!exists) {
          setValidationStatus('invalid');
          setValidationMessage('File not found');
          setIsValidating(false);
          return;
        }

        setValidationStatus('valid');
        setValidationMessage('Found');
      } else {
        const testSettings: AppSettings = {
          ...localSettings,
          engineMode: 'path',
        };

        const result = await runAutosuiteStreaming(
          testSettings,
          'capabilities',
          [],
          () => {}
        );

        if (result.envelope && result.envelope.success) {
          setValidationStatus('valid');
          setValidationMessage('Found');
        } else {
          setValidationStatus('invalid');
          setValidationMessage('Not found on PATH');
        }
      }
    } catch (err) {
      setValidationStatus('invalid');
      setValidationMessage(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    setValidationStatus('idle');
    setValidationMessage('');
  }, [localSettings.engineMode, localSettings.engineScriptPath]);

  const canSave = validationStatus === 'valid';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>Autosuite Engine</h3>
            <label>
              <input
                type="radio"
                checked={localSettings.engineMode === 'path'}
                onChange={() => setLocalSettings({ ...localSettings, engineMode: 'path' })}
              />
              <span>Use autosuite from PATH</span>
            </label>
            <label>
              <input
                type="radio"
                checked={localSettings.engineMode === 'script'}
                onChange={() => setLocalSettings({ ...localSettings, engineMode: 'script' })}
              />
              <span>Use autosuite script path</span>
            </label>
            {localSettings.engineMode === 'script' && (
              <div className="settings-input-group">
                <label>Script Path:</label>
                <input
                  type="text"
                  value={localSettings.engineScriptPath}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, engineScriptPath: e.target.value })
                  }
                  placeholder="C:\path\to\autosuite.ps1"
                />
              </div>
            )}
            
            <div className="validation-section">
              <button 
                className="action-button tertiary"
                onClick={validateSettings}
                disabled={isValidating}
              >
                {isValidating ? 'Checking...' : 'Validate'}
              </button>
              {validationStatus !== 'idle' && (
                <span className={`validation-status validation-${validationStatus}`}>
                  {validationMessage}
                </span>
              )}
            </div>
          </div>

          <details className="settings-section">
            <summary><h3>Advanced</h3></summary>
            <p className="settings-hint" style={{ marginBottom: '1rem' }}>
              Setups are stored as Autosuite profiles (JSON). You can change the storage location or manage them manually.
            </p>
            <div className="settings-input-group">
              <label>Custom Storage Directory (optional):</label>
              <input
                type="text"
                value={localSettings.customProfilesDirectory}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, customProfilesDirectory: e.target.value })
                }
                placeholder="Leave empty to use default: Documents\Autosuite\Setups"
              />
              <p className="settings-hint">
                By default, setups are stored in Documents\Autosuite\Setups. Only set this if you want to use a different location.
              </p>
            </div>
          </details>
        </div>
        <div className="modal-footer">
          <button className="action-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="action-button primary" 
            onClick={() => onSave(localSettings)}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
