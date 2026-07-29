import { act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from './test/test-utils';
import type { RunResult, StreamEvent, StreamingOptions } from './streaming-runner';
import type { AppSettings } from './settings';

const nativeWindow = vi.hoisted(() => ({
  listener: null as ((event: { payload: { type: string; paths?: string[] } }) => void) | null,
  unlisten: vi.fn(),
  onDragDropEvent: vi.fn(async (
    listener: (event: { payload: { type: string; paths?: string[] } }) => void,
  ) => {
    nativeWindow.listener = listener;
    return nativeWindow.unlisten;
  }),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    onDragDropEvent: nativeWindow.onDragDropEvent,
  }),
}));

vi.mock('./lib/engine-exec', async () => {
  const actual = await vi.importActual<typeof import('./lib/engine-exec')>('./lib/engine-exec');
  return {
    ...actual,
    runEndstateOnce: vi.fn(async (_settings, command: string) => ({
      success: true,
      envelope: {
        schemaVersion: '1.0',
        cliVersion: 'test',
        command,
        runId: `test-${command}`,
        timestampUtc: '2026-07-19T00:00:00Z',
        success: true,
        data: command === 'capabilities'
          ? {
              commands: ['capture', 'apply', 'verify', 'report'],
              features: {},
            }
          : {},
        error: null,
      },
      stdout: '',
      stderr: '',
      exitCode: 0,
    })),
  };
});

import App from './App';

let discoveredProfilePaths: string[];
let nativeImportCompletion: Promise<string> | null;
let profileManifestText: string;

async function runSuccessfulPreview<T>(): Promise<RunResult<T>> {
  return {
    exitCode: 0,
    envelope: {
      schemaVersion: '1.0',
      cliVersion: 'test',
      command: 'apply',
      runId: 'native-drop-preview',
      timestampUtc: '2026-07-19T00:00:00Z',
      success: true,
      data: {
        counts: { installed: 1, alreadyInstalled: 0, failed: 0, skippedFiltered: 0 },
        items: [],
        actions: [],
      } as T,
      error: null,
    },
    stdout: '',
    stderr: '',
    ndjsonEvents: [],
  };
}

async function runPreviewWithSynthesizedSettingsRow<T>(
  _settings: AppSettings,
  _command: string,
  _args: string[],
  _onEvent: (event: StreamEvent) => void,
  options?: StreamingOptions,
): Promise<RunResult<T>> {
  const eventBase = {
    version: 1,
    runId: 'provenance-preview',
    timestamp: '2026-07-29T00:00:00Z',
  };
  options?.onNdjsonEvent?.({
    ...eventBase,
    event: 'item',
    id: 'manual-demo',
    driver: 'manual',
    status: 'present',
    reason: 'already_installed',
    name: 'Manual demo app',
  });
  options?.onNdjsonEvent?.({
    ...eventBase,
    event: 'item',
    id: 'settings-only',
    driver: 'manual',
    status: 'present',
    reason: 'already_installed',
    name: 'Settings-only module',
  });

  return {
    exitCode: 0,
    envelope: {
      schemaVersion: '1.0',
      cliVersion: 'test',
      command: 'apply',
      runId: 'provenance-preview',
      timestampUtc: '2026-07-29T00:00:00Z',
      success: true,
      data: {
        actions: [
          { id: 'manual-demo', ref: null, driver: 'manual', status: 'present' },
          { id: 'settings-only', ref: null, driver: 'manual', status: 'present' },
        ],
        restoreModulesAvailable: [
          { id: 'apps.settings-only', displayName: 'Settings-only module' },
        ],
      } as T,
      error: null,
    },
    stdout: '',
    stderr: '',
    ndjsonEvents: [],
  };
}

describe('App native profile drag ownership', () => {
  beforeEach(() => {
    nativeWindow.listener = null;
    nativeWindow.unlisten.mockReset();
    nativeWindow.onDragDropEvent.mockClear();
    discoveredProfilePaths = ['C:\\test\\profiles\\existing-profile.jsonc'];
    nativeImportCompletion = null;
    profileManifestText = JSON.stringify({ apps: [{ id: 'existing-profile' }] });

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {
        core: {
          invoke: vi.fn(async (command: string, args?: { path?: string }) => {
            if (command === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (command === 'list_manifest_files') return discoveredProfilePaths;
            if (command === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'profile', version: 1, appCount: 1 } };
            }
            if (command === 'check_file_exists') return !!args?.path && discoveredProfilePaths.includes(args.path);
            if (command === 'read_text_file') return profileManifestText;
            if (command === 'create_directory') return null;
            if (command === 'delete_file') {
              const path = args?.path;
              if (path) discoveredProfilePaths = discoveredProfilePaths.filter((candidate) => candidate !== path);
              return null;
            }
            if (command === 'import_profile') {
              const importedPath = nativeImportCompletion
                ? await nativeImportCompletion
                : 'C:\\test\\profiles\\dropped-profile.jsonc';
              discoveredProfilePaths = [...discoveredProfilePaths, importedPath];
              return importedPath;
            }
            return null;
          }),
        },
        event: {
          listen: vi.fn(async () => vi.fn()),
        },
      },
    });
    window.__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: runSuccessfulPreview,
    };
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    Reflect.deleteProperty(window, '__TAURI__');
    Reflect.deleteProperty(window, '__ENDSTATE_MOCK_ENGINE__');
  });

  it('shows supported Tauri v2 drag feedback on landing and cleans up its owner on unmount', async () => {
    const view = renderWithProviders(<App />);

    await screen.findByTestId('intent-save');
    await waitFor(() => expect(nativeWindow.onDragDropEvent).toHaveBeenCalledTimes(1));

    act(() => {
      nativeWindow.listener?.({
        payload: { type: 'enter', paths: ['C:\\Downloads\\capture.zip'] },
      });
    });
    expect(screen.getByTestId('native-profile-drop-feedback')).toHaveTextContent('Drop to import');

    act(() => {
      nativeWindow.listener?.({ payload: { type: 'over' } });
    });
    expect(screen.getByTestId('native-profile-drop-feedback')).toHaveTextContent('Drop to import');

    view.unmount();
    expect(nativeWindow.unlisten).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('native-profile-drop-feedback')).not.toBeInTheDocument();
  });

  it('returns an idle Setup preview to the visible profile list before importing a native drop', async () => {
    const user = userEvent.setup();
    let finishImport!: (path: string) => void;
    nativeImportCompletion = new Promise((resolve) => {
      finishImport = resolve;
    });
    renderWithProviders(<App />);

    await user.click(await screen.findByTestId('intent-setup'));
    await user.click(await screen.findByTestId('profile-card-existing-profile'));
    await screen.findByText('Preview complete');
    expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();

    act(() => {
      nativeWindow.listener?.({
        payload: { type: 'drop', paths: ['C:\\Downloads\\dropped-profile.jsonc'] },
      });
    });

    await screen.findByTestId('drop-zone');
    expect(screen.getByTestId('profile-import-progress')).toHaveTextContent('Importing profile');
    expect(screen.getByTestId('setup-flow-back')).toBeDisabled();
    expect(screen.queryByTestId('profile-card-dropped-profile')).not.toBeInTheDocument();

    act(() => {
      finishImport('C:\\test\\profiles\\dropped-profile.jsonc');
    });

    const importedCard = await screen.findByTestId('profile-card-dropped-profile');
    expect(importedCard).toHaveTextContent('Imported');
    expect(importedCard).toHaveTextContent('Review setup');
    expect(screen.queryByTestId('profile-import-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('setup-flow-back')).toBeEnabled();
    expect(screen.queryByText('Preview complete')).not.toBeInTheDocument();
  });

  it('keeps Setup profile choices separate from the saved capture profile', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tauri:endstate-gui-settings', JSON.stringify({
      selectedProfileName: null,
      dryRunDefaultCorrected: true,
    }));
    renderWithProviders(<App />);

    await user.click(await screen.findByTestId('intent-setup'));
    await user.click(await screen.findByTestId('profile-card-existing-profile'));
    await screen.findByText('Preview complete');

    const stored = JSON.parse(localStorage.getItem('tauri:endstate-gui-settings') ?? '{}');
    expect(stored.selectedProfileName).toBeNull();
  });

  it('separates engine-synthesized settings rows from authored manual apps', async () => {
    const user = userEvent.setup();
    profileManifestText = JSON.stringify({ apps: [{ id: 'manual-demo' }] });
    window.__ENDSTATE_MOCK_ENGINE__ = {
      runEndstateStreaming: runPreviewWithSynthesizedSettingsRow,
    };
    renderWithProviders(<App />);

    await user.click(await screen.findByTestId('intent-setup'));
    await user.click(await screen.findByTestId('profile-card-existing-profile'));
    await screen.findByText('Preview complete');

    expect(screen.getByText('1 app')).toBeInTheDocument();
    expect(screen.getByText('Settings only — app installation not included')).toBeInTheDocument();
    expect(screen.getByText('Manual demo app')).toBeInTheDocument();
    expect(screen.getByText('Settings-only module')).toBeInTheDocument();
  });

  it('clears a deliberately deleted capture profile instead of switching profiles', async () => {
    const user = userEvent.setup();
    discoveredProfilePaths = [
      'C:\\test\\profiles\\existing-profile.jsonc',
      'C:\\test\\profiles\\other-profile.jsonc',
    ];
    localStorage.setItem('tauri:endstate-gui-settings', JSON.stringify({
      selectedProfileName: 'existing-profile',
      dryRunDefaultCorrected: true,
    }));
    renderWithProviders(<App />);

    await user.click(await screen.findByTestId('intent-setup'));
    const selectedCard = await screen.findByTestId('profile-card-existing-profile');
    await user.click(within(selectedCard).getByLabelText('Delete existing-profile'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByTestId('profile-card-existing-profile')).not.toBeInTheDocument());
    expect(screen.queryByTestId('profile-missing-modal')).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('tauri:endstate-gui-settings') ?? '{}');
    expect(stored.selectedProfileName).toBeNull();
  });

  it('keeps a pending native import visible across every global navigation route', async () => {
    const user = userEvent.setup();
    let finishImport!: (path: string) => void;
    nativeImportCompletion = new Promise((resolve) => {
      finishImport = resolve;
    });
    renderWithProviders(<App />);

    await user.click(await screen.findByTestId('intent-setup'));
    await user.click(await screen.findByTestId('profile-card-existing-profile'));
    await screen.findByText('Preview complete');

    act(() => {
      nativeWindow.listener?.({
        payload: { type: 'drop', paths: ['C:\\Downloads\\dropped-profile.jsonc'] },
      });
    });

    await screen.findByTestId('profile-import-progress');

    await user.click(screen.getByTitle('Settings'));
    expect(screen.getByTestId('profile-import-progress')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Settings', level: 1 })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: ',', ctrlKey: true });
    expect(screen.getByTestId('profile-import-progress')).toBeVisible();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await user.click(await screen.findByRole('button', { name: /Go to Home/i }));
    expect(screen.getByTestId('profile-import-progress')).toBeVisible();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await user.click(await screen.findByRole('button', { name: /Undo Settings Changes/i }));
    expect(screen.getByTestId('profile-import-progress')).toBeVisible();

    act(() => {
      finishImport('C:\\test\\profiles\\dropped-profile.jsonc');
    });

    const importedCard = await screen.findByTestId('profile-card-dropped-profile');
    expect(importedCard).toHaveTextContent('Imported');
    expect(importedCard).toHaveTextContent('Review setup');
    expect(screen.queryByText('Undo settings changes from your last setup')).not.toBeInTheDocument();
  });
});
