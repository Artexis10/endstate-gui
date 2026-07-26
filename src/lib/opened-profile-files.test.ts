import { describe, expect, it, vi } from 'vitest';
import {
  createOpenedFilesHandler,
  selectProfilePathsFromArgv,
} from './opened-profile-files';
import { createProfileImportCoordinator } from './native-profile-drop';

function dependencies(overrides: { isRunning?: () => boolean } = {}) {
  return {
    isRunning: overrides.isRunning ?? (() => false),
    coordinator: createProfileImportCoordinator(),
    openSetup: vi.fn(),
    importPaths: vi.fn().mockResolvedValue(undefined),
    onBlocked: vi.fn(),
  };
}

describe('selectProfilePathsFromArgv', () => {
  it('selects a capture bundle handed over by the file association', () => {
    expect(selectProfilePathsFromArgv(['C:\\Downloads\\work.endstate'])).toEqual([
      'C:\\Downloads\\work.endstate',
    ]);
  });

  it('selects a bare manifest, matching every other import surface', () => {
    expect(selectProfilePathsFromArgv(['C:\\Downloads\\work.jsonc'])).toEqual([
      'C:\\Downloads\\work.jsonc',
    ]);
  });

  it('still accepts the legacy .zip bundle name', () => {
    expect(selectProfilePathsFromArgv(['C:\\Downloads\\work.zip'])).toEqual([
      'C:\\Downloads\\work.zip',
    ]);
  });

  it('matches the extension case-insensitively', () => {
    expect(selectProfilePathsFromArgv(['C:\\Downloads\\WORK.ENDSTATE'])).toEqual([
      'C:\\Downloads\\WORK.ENDSTATE',
    ]);
  });

  it('ignores the updater relaunch flag', () => {
    expect(selectProfilePathsFromArgv(['--updated'])).toEqual([]);
  });

  it('ignores an option whose value happens to end in a profile extension', () => {
    expect(selectProfilePathsFromArgv(['--config=C:\\dev\\settings.json'])).toEqual([]);
  });

  it('ignores an empty argv', () => {
    expect(selectProfilePathsFromArgv([])).toEqual([]);
  });

  it('ignores a path that names no profile', () => {
    expect(selectProfilePathsFromArgv(['C:\\Downloads\\notes.txt'])).toEqual([]);
  });

  it('ignores our own executable path, should argv[0] ever reach it', () => {
    // Rust strips argv[0] before handing arguments over. This is the second
    // line of defence: an .exe is not a profile, so it cannot be imported even
    // if that strip were wrong.
    expect(
      selectProfilePathsFromArgv([
        'C:\\Program Files\\Endstate\\endstate.exe',
        'C:\\Downloads\\work.endstate',
      ]),
    ).toEqual(['C:\\Downloads\\work.endstate']);
  });

  it('keeps only the profile operands when flags and files are mixed', () => {
    expect(
      selectProfilePathsFromArgv([
        '--updated',
        'C:\\Downloads\\work.endstate',
        'C:\\Downloads\\readme.md',
      ]),
    ).toEqual(['C:\\Downloads\\work.endstate']);
  });
});

describe('createOpenedFilesHandler', () => {
  it('opens the Set up flow and imports the opened bundle', async () => {
    const deps = dependencies();

    createOpenedFilesHandler(deps)(['C:\\Downloads\\work.endstate']);

    expect(deps.openSetup).toHaveBeenCalledTimes(1);
    expect(deps.importPaths).toHaveBeenCalledWith(['C:\\Downloads\\work.endstate']);
    expect(deps.onBlocked).not.toHaveBeenCalled();
  });

  it('does nothing at all for argv that names no profile', () => {
    const deps = dependencies();

    createOpenedFilesHandler(deps)(['--updated']);

    expect(deps.openSetup).not.toHaveBeenCalled();
    expect(deps.importPaths).not.toHaveBeenCalled();
    // Critically: no error toast either. A stray flag is not a failed import.
    expect(deps.onBlocked).not.toHaveBeenCalled();
  });

  it('tolerates a missing payload from the warm-start event', () => {
    const deps = dependencies();

    createOpenedFilesHandler(deps)(undefined);

    expect(deps.importPaths).not.toHaveBeenCalled();
    expect(deps.onBlocked).not.toHaveBeenCalled();
  });

  it('refuses and explains while a run is in progress', () => {
    const deps = dependencies({ isRunning: () => true });

    createOpenedFilesHandler(deps)(['C:\\Downloads\\work.endstate']);

    expect(deps.importPaths).not.toHaveBeenCalled();
    expect(deps.openSetup).not.toHaveBeenCalled();
    expect(deps.onBlocked).toHaveBeenCalledTimes(1);
  });

  it('refuses a second bundle while the first import still holds the lease', () => {
    const deps = dependencies();
    let finishFirst!: () => void;
    deps.importPaths.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finishFirst = resolve;
      }),
    );
    const handleOpenedFiles = createOpenedFilesHandler(deps);

    handleOpenedFiles(['C:\\Downloads\\first.endstate']);
    handleOpenedFiles(['C:\\Downloads\\second.endstate']);

    expect(deps.importPaths).toHaveBeenCalledTimes(1);
    expect(deps.onBlocked).toHaveBeenCalledTimes(1);

    finishFirst();
  });

  it('releases the lease when the import fails, so the next open still works', async () => {
    const deps = dependencies();
    deps.importPaths.mockRejectedValueOnce(new Error('unreadable bundle'));
    const handleOpenedFiles = createOpenedFilesHandler(deps);

    handleOpenedFiles(['C:\\Downloads\\broken.endstate']);
    await Promise.resolve();
    await Promise.resolve();

    handleOpenedFiles(['C:\\Downloads\\good.endstate']);

    expect(deps.importPaths).toHaveBeenNthCalledWith(2, ['C:\\Downloads\\good.endstate']);
  });
});
