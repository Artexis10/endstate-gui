import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createNativeProfileDropHandler,
  createProfileImportCoordinator,
} from './native-profile-drop';
import { isTauriRuntime } from './tauri-bridge';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('native profile drop handling', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('detects a packaged Tauri v2 runtime from its only window marker', () => {
    Reflect.deleteProperty(window, '__TAURI_IPC__');
    Reflect.deleteProperty(window, '__TAURI__');
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });

    expect(isTauriRuntime()).toBe(true);
  });

  it('drives controlled App-level acceptance through enter, over, leave, and cancellation', () => {
    const setDragAccepted = vi.fn();
    const dependencies = {
      isRunning: () => false,
      coordinator: createProfileImportCoordinator(),
      openSetup: vi.fn(),
      importPaths: vi.fn().mockResolvedValue(undefined),
      onBlocked: vi.fn(),
      setDragAccepted,
    } as Parameters<typeof createNativeProfileDropHandler>[0] & {
      setDragAccepted: (accepted: boolean) => void;
    };
    const handleDrag = createNativeProfileDropHandler(dependencies);

    handleDrag({ payload: { type: 'enter', paths: ['C:\\Downloads\\capture.zip'] } });
    expect(setDragAccepted).toHaveBeenLastCalledWith(true);

    // Tauri v2 over events may omit paths; acceptance established by enter
    // remains visible until a terminal lifecycle event.
    handleDrag({ payload: { type: 'over' } });
    expect(setDragAccepted).toHaveBeenLastCalledWith(true);
    expect(dependencies.importPaths).not.toHaveBeenCalled();

    handleDrag({ payload: { type: 'leave' } });
    expect(setDragAccepted).toHaveBeenLastCalledWith(false);

    handleDrag({ payload: { type: 'enter', paths: ['C:\\Downloads\\capture.zip'] } });
    handleDrag({ payload: { type: 'cancel' } });
    expect(setDragAccepted).toHaveBeenLastCalledWith(false);
  });

  it('clears App-owned acceptance when the native listener owner unmounts', () => {
    const setDragAccepted = vi.fn();
    const handleDrag = createNativeProfileDropHandler({
      isRunning: () => false,
      coordinator: createProfileImportCoordinator(),
      openSetup: vi.fn(),
      importPaths: vi.fn().mockResolvedValue(undefined),
      onBlocked: vi.fn(),
      setDragAccepted,
    });

    handleDrag({ payload: { type: 'enter', paths: ['C:\\Downloads\\capture.zip'] } });
    expect(setDragAccepted).toHaveBeenLastCalledWith(true);

    handleDrag.dispose();
    expect(setDragAccepted).toHaveBeenLastCalledWith(false);
  });

  it('never accepts or imports unsupported native paths', () => {
    const setDragAccepted = vi.fn();
    const importPaths = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      isRunning: () => false,
      coordinator: createProfileImportCoordinator(),
      openSetup: vi.fn(),
      importPaths,
      onBlocked: vi.fn(),
      setDragAccepted,
    } as Parameters<typeof createNativeProfileDropHandler>[0] & {
      setDragAccepted: (accepted: boolean) => void;
    };
    const handleDrag = createNativeProfileDropHandler(dependencies);

    handleDrag({ payload: { type: 'enter', paths: ['C:\\Downloads\\notes.txt'] } });
    handleDrag({ payload: { type: 'over', paths: ['C:\\Downloads\\notes.txt'] } });
    handleDrag({ payload: { type: 'drop', paths: ['C:\\Downloads\\notes.txt'] } });

    expect(setDragAccepted).toHaveBeenLastCalledWith(false);
    expect(dependencies.openSetup).not.toHaveBeenCalled();
    expect(importPaths).not.toHaveBeenCalled();
  });

  it('opens Setup before importing and rejects a concurrent native drop', async () => {
    const firstImport = deferred();
    const coordinator = createProfileImportCoordinator();
    const order: string[] = [];
    const importPaths = vi.fn(async () => {
      order.push('import');
      await firstImport.promise;
    });
    const onBlocked = vi.fn();
    const handleDrop = createNativeProfileDropHandler({
      isRunning: () => false,
      coordinator,
      openSetup: () => order.push('setup'),
      importPaths,
      onBlocked,
    });

    handleDrop({
      payload: {
        type: 'drop',
        paths: [
          'C:\\Downloads\\capture.zip',
          'C:\\Downloads\\notes.txt',
          'C:\\Downloads\\work.jsonc',
          'C:\\Downloads\\portable.JSON5',
        ],
      },
    });
    handleDrop({ payload: { type: 'drop', paths: ['C:\\Downloads\\second.jsonc'] } });

    expect(order).toEqual(['setup', 'import']);
    expect(importPaths).toHaveBeenCalledWith([
      'C:\\Downloads\\capture.zip',
      'C:\\Downloads\\work.jsonc',
      'C:\\Downloads\\portable.JSON5',
    ]);
    expect(importPaths).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledTimes(1);

    firstImport.resolve();
    await firstImport.promise;
    await Promise.resolve();

    handleDrop({ payload: { type: 'drop', paths: ['C:\\Downloads\\third.JSONC'] } });
    expect(importPaths).toHaveBeenCalledTimes(2);
  });

  it('rejects a native profile drop while an engine operation is running', () => {
    const importPaths = vi.fn().mockResolvedValue(undefined);
    const openSetup = vi.fn();
    const onBlocked = vi.fn();
    const setDragAccepted = vi.fn();
    const dependencies = {
      isRunning: () => true,
      coordinator: createProfileImportCoordinator(),
      openSetup,
      importPaths,
      onBlocked,
      setDragAccepted,
    } as Parameters<typeof createNativeProfileDropHandler>[0] & {
      setDragAccepted: (accepted: boolean) => void;
    };
    const handleDrop = createNativeProfileDropHandler(dependencies);

    handleDrop({ payload: { type: 'enter', paths: ['C:\\Downloads\\capture.zip'] } });
    handleDrop({ payload: { type: 'drop', paths: ['C:\\Downloads\\capture.zip'] } });

    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(setDragAccepted).toHaveBeenLastCalledWith(false);
    expect(openSetup).not.toHaveBeenCalled();
    expect(importPaths).not.toHaveBeenCalled();
  });
});
