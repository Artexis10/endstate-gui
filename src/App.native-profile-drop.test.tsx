import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from './test/test-utils';

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

describe('App native profile drag ownership', () => {
  beforeEach(() => {
    nativeWindow.listener = null;
    nativeWindow.unlisten.mockReset();
    nativeWindow.onDragDropEvent.mockClear();

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
            if (command === 'list_manifest_files') return [];
            return null;
          }),
        },
        event: {
          listen: vi.fn(async () => vi.fn()),
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    Reflect.deleteProperty(window, '__TAURI__');
  });

  it('shows supported Tauri v2 drag feedback on landing and cleans up its owner on unmount', async () => {
    const view = renderWithProviders(<App />);

    await screen.findByText('Save this computer');
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
});
