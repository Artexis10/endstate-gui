import { useEffect, useState } from 'react';
import { checkCliCapabilities, CliStatus } from './tauri-bridge';
import './App.css';

function App() {
  const [status, setStatus] = useState<CliStatus>({
    state: 'checking',
  });

  useEffect(() => {
    checkCliCapabilities().then(setStatus);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Autosuite</h1>
      </header>
      <main className="app-main">
        <CliStatusDisplay status={status} />
      </main>
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
