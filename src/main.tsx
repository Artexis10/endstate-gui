import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ScreenshotHarness } from './screenshots-harness';
import './styles/globals.css';
import { isE2EMode, installMockEngine } from './e2e/mock-engine';

// In E2E mode, install deterministic mock engine if not already mocked by test harness
if (isE2EMode() && typeof window !== 'undefined' && !(window as any).__ENDSTATE_MOCK_ENGINE__) {
  installMockEngine();
}

const isScreenshotMode = new URLSearchParams(window.location.search).has('screenshots');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isScreenshotMode ? <ScreenshotHarness /> : <App />}
  </React.StrictMode>,
);
