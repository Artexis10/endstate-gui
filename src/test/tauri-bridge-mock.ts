import { vi } from 'vitest';

export interface TauriBridgeMock {
  invoke: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  isTauriRuntime: ReturnType<typeof vi.fn>;
  getProfilesDirectory: ReturnType<typeof vi.fn>;
  ensureDirectory: ReturnType<typeof vi.fn>;
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
