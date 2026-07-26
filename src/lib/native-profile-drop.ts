import { isSupportedProfilePath } from './profile-extensions';

// Re-exported so existing callers (and tests) keep importing the predicate from
// here, while the extension list itself lives in exactly one place.
export { isSupportedProfilePath };

export interface NativeProfileDropEvent {
  payload: {
    type: string;
    paths?: string[];
  };
}

export interface ProfileImportLease {
  release: () => void;
}

export interface ProfileImportCoordinator {
  tryAcquire: () => ProfileImportLease | null;
}

/**
 * What it takes to turn a list of accepted profile paths into an import,
 * independent of how those paths arrived.
 *
 * Shared with the file-association path (`./opened-profile-files`) so a bundle
 * that was dropped and a bundle that was double-clicked behave identically.
 */
export interface ProfileImportDependencies {
  isRunning: () => boolean;
  coordinator: ProfileImportCoordinator;
  openSetup: () => void;
  importPaths: (paths: string[]) => Promise<void>;
  onBlocked: () => void;
}

export interface NativeProfileDropDependencies extends ProfileImportDependencies {
  setDragAccepted?: (accepted: boolean) => void;
}

/**
 * Start importing already-accepted profile paths.
 *
 * Refuses while a run or another import holds the app, takes the single import
 * lease, opens the Set up flow, and releases the lease however the import ends.
 * The one funnel every entry point goes through.
 */
export function beginProfileImport(
  dependencies: ProfileImportDependencies,
  paths: string[],
): void {
  if (paths.length === 0) return;

  if (dependencies.isRunning()) {
    dependencies.onBlocked();
    return;
  }

  const lease = dependencies.coordinator.tryAcquire();
  if (!lease) {
    dependencies.onBlocked();
    return;
  }

  dependencies.openSetup();
  void dependencies.importPaths(paths).then(
    () => lease.release(),
    () => lease.release(),
  );
}

export interface NativeProfileDropHandler {
  (event: NativeProfileDropEvent): void;
  dispose: () => void;
}

export function createProfileImportCoordinator(): ProfileImportCoordinator {
  let active = false;

  return {
    tryAcquire: () => {
      if (active) return null;

      active = true;
      let released = false;
      return {
        release: () => {
          if (released) return;
          released = true;
          active = false;
        },
      };
    },
  };
}

export function createNativeProfileDropHandler(
  dependencies: NativeProfileDropDependencies,
): NativeProfileDropHandler {
  const setAccepted = (accepted: boolean) => {
    dependencies.setDragAccepted?.(accepted);
  };

  const handler = ((event: NativeProfileDropEvent) => {
    const eventType = event.payload.type;
    const acceptedPaths = (event.payload.paths ?? []).filter(isSupportedProfilePath);

    if (eventType === 'leave' || eventType === 'cancel' || eventType === 'cancelled') {
      setAccepted(false);
      return;
    }

    if (eventType === 'enter') {
      setAccepted(!dependencies.isRunning() && acceptedPaths.length > 0);
      return;
    }

    if (eventType === 'over') {
      if (dependencies.isRunning()) {
        setAccepted(false);
      } else if (event.payload.paths) {
        setAccepted(acceptedPaths.length > 0);
      }
      // Tauri v2 may omit paths from over events. In that case retain the
      // acceptance established by enter, including across React re-renders.
      return;
    }

    if (eventType !== 'drop') return;
    setAccepted(false);
    beginProfileImport(dependencies, acceptedPaths);
  }) as NativeProfileDropHandler;

  handler.dispose = () => setAccepted(false);
  return handler;
}
