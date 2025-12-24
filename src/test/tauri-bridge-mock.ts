import { vi, type Mock } from 'vitest';

/**
 * Typed mock interface for tauri-bridge functions.
 * Uses Mock<T, Y> where T is args tuple and Y is return type.
 * These are intentionally permissive to allow calling without args in tests.
 */
export interface TauriBridgeMock {
  invoke: Mock<(cmd?: string, args?: Record<string, unknown>) => Promise<unknown>>;
  listen: Mock<(event?: string, handler?: (event: { payload: unknown }) => void) => Promise<() => void>>;
  isTauriRuntime: Mock<() => boolean>;
  getProfilesDirectory: Mock<(customDir?: string) => Promise<string>>;
  ensureDirectory: Mock<(path?: string) => Promise<void>>;
}

export function createTauriBridgeMock(overrides?: Partial<TauriBridgeMock>): TauriBridgeMock {
  const defaultMock: TauriBridgeMock = {
    invoke: vi.fn().mockResolvedValue(null),
    listen: vi.fn().mockResolvedValue(() => {}),
    isTauriRuntime: vi.fn().mockReturnValue(false),
    getProfilesDirectory: vi.fn().mockResolvedValue('C:\\test\\profiles'),
    ensureDirectory: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ...defaultMock,
    ...overrides,
  };
}

export function mockTauriBridge(mockImplementation?: Partial<TauriBridgeMock>) {
  const mock = createTauriBridgeMock(mockImplementation);
  
  vi.doMock('../lib/tauri-bridge', () => mock);
  
  return mock;
}

export function setupTauriMockForTests() {
  if (typeof window !== 'undefined') {
    (window as any).__TAURI__ = {
      core: {
        invoke: vi.fn().mockResolvedValue(null),
      },
      event: {
        listen: vi.fn().mockResolvedValue(() => {}),
      },
    };
  }
}

export function clearTauriMock() {
  if (typeof window !== 'undefined') {
    delete (window as any).__TAURI__;
  }
}
