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

export interface NativeProfileDropDependencies {
  isRunning: () => boolean;
  coordinator: ProfileImportCoordinator;
  openSetup: () => void;
  importPaths: (paths: string[]) => Promise<void>;
  onBlocked: () => void;
  setDragAccepted?: (accepted: boolean) => void;
}

export interface NativeProfileDropHandler {
  (event: NativeProfileDropEvent): void;
  dispose: () => void;
}

export function isSupportedProfilePath(path: string): boolean {
  const normalized = path.toLowerCase();
  return normalized.endsWith('.zip')
    || normalized.endsWith('.json')
    || normalized.endsWith('.jsonc')
    || normalized.endsWith('.json5');
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
    if (acceptedPaths.length === 0) return;

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
    void dependencies.importPaths(acceptedPaths).then(
      () => lease.release(),
      () => lease.release(),
    );
  }) as NativeProfileDropHandler;

  handler.dispose = () => setAccepted(false);
  return handler;
}
