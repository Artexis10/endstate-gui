import { describe, expect, it, vi } from 'vitest';
import {
  createNativeProfileDropHandler,
  createProfileImportCoordinator,
} from './native-profile-drop';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('native profile drop handling', () => {
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
        paths: ['C:\\Downloads\\capture.zip', 'C:\\Downloads\\notes.txt'],
      },
    });
    handleDrop({ payload: { type: 'drop', paths: ['C:\\Downloads\\second.jsonc'] } });

    expect(order).toEqual(['setup', 'import']);
    expect(importPaths).toHaveBeenCalledWith(['C:\\Downloads\\capture.zip']);
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
    const handleDrop = createNativeProfileDropHandler({
      isRunning: () => true,
      coordinator: createProfileImportCoordinator(),
      openSetup,
      importPaths,
      onBlocked,
    });

    handleDrop({ payload: { type: 'drop', paths: ['C:\\Downloads\\capture.zip'] } });

    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(openSetup).not.toHaveBeenCalled();
    expect(importPaths).not.toHaveBeenCalled();
  });
});
