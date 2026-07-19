import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from './test/test-utils';
import type { RunResult } from './streaming-runner';

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

describe('App native profile drag ownership', () => {
  beforeEach(() => {
    nativeWindow.listener = null;
    nativeWindow.unlisten.mockReset();
    nativeWindow.onDragDropEvent.mockClear();
    discoveredProfilePaths = ['C:\\test\\profiles\\existing-profile.jsonc'];
    nativeImportCompletion = null;

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {
        core: {
          invoke: vi.fn(async (command: string) => {
            if (command === 'get_default_profiles_directory') return 'C:\\test\\profiles';
            if (command === 'list_manifest_files') return discoveredProfilePaths;
            if (command === 'validate_profile') {
              return { valid: true, errors: [], summary: { name: 'profile', version: 1, appCount: 1 } };
            }
            if (command === 'check_file_exists') return false;
            if (command === 'create_directory') return null;
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
});
