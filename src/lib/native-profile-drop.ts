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
): (event: NativeProfileDropEvent) => void {
  return (event) => {
    if (event.payload.type !== 'drop') return;

    const acceptedPaths = (event.payload.paths ?? []).filter((path) => {
      const normalized = path.toLowerCase();
      return normalized.endsWith('.zip')
        || normalized.endsWith('.json')
        || normalized.endsWith('.jsonc')
        || normalized.endsWith('.json5');
    });
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
  };
}
