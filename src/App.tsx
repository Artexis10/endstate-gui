import { useEffect, useState, useRef, useCallback } from 'react';
import { checkCliCapabilities, CliStatus } from './tauri-bridge';
import {
  subscribeToEvents,
  runCapabilities,
  runVerify,
  runApply,
  EngineEvent,
  isLogEvent,
  isResultEvent,
  isCliEnvelope,
  isTerminalResult,
} from './engine-bridge';
import './App.css';

/** Log entry for display */
interface LogEntry {
  id: number;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

/** Result state for display */
interface ResultState {
  ok: boolean;
  command: string;
  summary: Record<string, unknown>;
  raw: unknown | null;
}

// Hardcoded manifest path for testing - update this to a valid path on your system
const SAMPLE_MANIFEST_PATH = 'C:\\manifests\\sample.jsonc';

function App() {
  const [status, setStatus] = useState<CliStatus>({
    state: 'checking',
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ResultState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to engine events
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    subscribeToEvents((event: EngineEvent) => {
      if (isLogEvent(event)) {
        const entry: LogEntry = {
          id: logIdRef.current++,
          timestamp: new Date(),
          level: event.level,
          message: event.message,
        };
        setLogs((prev) => [...prev, entry]);
      } else if (isResultEvent(event)) {
        setResult({
          ok: event.ok,
          command: event.command,
          summary: event.summary as Record<string, unknown>,
          raw: event.raw,
        });
        setIsRunning(false);
      } else if (isCliEnvelope(event)) {
        setResult({
          ok: event.success,
          command: event.command,
          summary: event.data as Record<string, unknown>,
          raw: event,
        });
        setIsRunning(false);
      } else if (isTerminalResult(event)) {
        // Catch-all for any other terminal result shape
        setIsRunning(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Check CLI on startup
  useEffect(() => {
    checkCliCapabilities().then(setStatus);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setResult(null);
  }, []);

  const handleRunCapabilities = useCallback(async () => {
    clearLogs();
    setIsRunning(true);
    try {
      await runCapabilities();
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          id: logIdRef.current++,
          timestamp: new Date(),
          level: 'error',
          message: `Failed to run: ${err}`,
        },
      ]);
      setIsRunning(false);
    }
  }, [clearLogs]);

  const handleRunVerify = useCallback(async () => {
    clearLogs();
    setIsRunning(true);
    try {
      await runVerify(SAMPLE_MANIFEST_PATH);
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          id: logIdRef.current++,
          timestamp: new Date(),
          level: 'error',
          message: `Failed to run: ${err}`,
        },
      ]);
      setIsRunning(false);
    }
  }, [clearLogs]);

  const handleRunApply = useCallback(async () => {
    clearLogs();
    setIsRunning(true);
    try {
      await runApply(SAMPLE_MANIFEST_PATH);
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          id: logIdRef.current++,
          timestamp: new Date(),
          level: 'error',
          message: `Failed to run: ${err}`,
        },
      ]);
      setIsRunning(false);
    }
  }, [clearLogs]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Autosuite</h1>
      </header>
      <main className="app-main-engine">
        <div className="engine-panel">
          <CliStatusDisplay status={status} />
          
          <div className="button-bar">
            <button
              className="engine-button"
              onClick={handleRunCapabilities}
              disabled={isRunning || status.state !== 'ready'}
            >
              Capabilities
            </button>
            <button
              className="engine-button"
              onClick={handleRunVerify}
              disabled={isRunning || status.state !== 'ready'}
            >
              Verify
            </button>
            <button
              className="engine-button"
              onClick={handleRunApply}
              disabled={isRunning || status.state !== 'ready'}
            >
              Apply
            </button>
            <button
              className="engine-button secondary"
              onClick={clearLogs}
              disabled={isRunning}
            >
              Clear
            </button>
          </div>

          <div className="log-container" ref={logContainerRef}>
            {logs.length === 0 ? (
              <div className="log-empty">
                Click a button above to run a command and see streaming output here.
              </div>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className={`log-entry log-${entry.level}`}>
                  <span className="log-time">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="log-level">[{entry.level.toUpperCase()}]</span>
                  <span className="log-message">{entry.message}</span>
                </div>
              ))
            )}
          </div>

          {result && <ResultDisplay result={result} />}
        </div>
      </main>
    </div>
  );
}

function ResultDisplay({ result }: { result: ResultState }) {
  return (
    <div className={`result-card ${result.ok ? 'result-success' : 'result-failure'}`}>
      <div className="result-header">
        <span className="result-icon">{result.ok ? '✓' : '✗'}</span>
        <span className="result-title">
          {result.command} - {result.ok ? 'Success' : 'Failed'}
        </span>
      </div>
      <div className="result-summary">
        <h4>Summary</h4>
        <pre>{JSON.stringify(result.summary, null, 2)}</pre>
      </div>
      {result.raw !== null && result.raw !== undefined && (
        <div className="result-raw">
          <h4>Raw Output</h4>
          <pre>{JSON.stringify(result.raw, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function CliStatusDisplay({ status }: { status: CliStatus }) {
  if (status.state === 'checking') {
    return (
      <div className="status-card status-checking">
        <div className="status-icon">⏳</div>
        <div className="status-text">
          <h2>Checking CLI...</h2>
          <p>Looking for Autosuite CLI on PATH</p>
        </div>
      </div>
    );
  }

  if (status.state === 'ready') {
    return (
      <div className="status-card status-ready">
        <div className="status-icon">✓</div>
        <div className="status-text">
          <h2>Autosuite CLI detected</h2>
          <p>Version: {status.cliVersion}</p>
          <p className="schema-version">Schema: {status.schemaVersion}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="status-card status-error">
      <div className="status-icon">✗</div>
      <div className="status-text">
        <h2>CLI Error</h2>
        <p className="error-message">{status.error}</p>
      </div>
    </div>
  );
}

export default App;
