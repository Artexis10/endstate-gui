import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from './test-utils';
import { seedLocalStorage, getLocalStorageKeys, assertLocalStorageKey, getLocalStorageSnapshot } from './localStorage-helpers';
import { mockTauriBridge, setupTauriMockForTests, clearTauriMock } from './tauri-bridge-mock';
import { Button } from '../components/ui/button';

describe('Test Foundation', () => {
  describe('renderWithProviders', () => {
    it('renders components with providers', () => {
      renderWithProviders(
        <div>
          <h1>Test Component</h1>
          <Button>Click me</Button>
        </div>
      );

      expect(screen.getByText('Test Component')).toBeTruthy();
      expect(screen.getByRole('button', { name: /click me/i })).toBeTruthy();
    });

    it('supports initial route configuration', () => {
      renderWithProviders(
        <div data-testid="route-display">{window.location.pathname}</div>,
        { initialRoute: '/test-route' }
      );

      const display = screen.getByTestId('route-display');
      expect(display.textContent).toContain('/');
    });

    it('renders without initial route', () => {
      renderWithProviders(<div>No route specified</div>);
      expect(screen.getByText('No route specified')).toBeTruthy();
    });
  });

  describe('localStorage helpers', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('seedLocalStorage sets string values', () => {
      seedLocalStorage({ key1: 'value1', key2: 'value2' });

      expect(localStorage.getItem('key1')).toBe('value1');
      expect(localStorage.getItem('key2')).toBe('value2');
    });

    it('seedLocalStorage serializes objects', () => {
      const obj = { nested: { value: 42 } };
      seedLocalStorage({ myObject: obj });

      const stored = localStorage.getItem('myObject');
      expect(stored).toBe(JSON.stringify(obj));
      expect(JSON.parse(stored!)).toEqual(obj);
    });

    it('getLocalStorageKeys returns all keys', () => {
      seedLocalStorage({ a: '1', b: '2', c: '3' });

      const keys = getLocalStorageKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
    });

    it('getLocalStorageSnapshot captures all data', () => {
      seedLocalStorage({ key1: 'val1', key2: 'val2' });

      const snapshot = getLocalStorageSnapshot();
      expect(snapshot).toEqual({
        key1: 'val1',
        key2: 'val2',
      });
    });

    it('assertLocalStorageKey validates key exists', () => {
      seedLocalStorage({ testKey: 'testValue' });

      expect(() => assertLocalStorageKey('testKey')).not.toThrow();
    });

    it('assertLocalStorageKey throws when key missing', () => {
      expect(() => assertLocalStorageKey('nonexistent')).toThrow(/Expected localStorage key "nonexistent" to exist/);
    });

    it('assertLocalStorageKey validates string value', () => {
      seedLocalStorage({ testKey: 'expectedValue' });

      expect(() => assertLocalStorageKey('testKey', 'expectedValue')).not.toThrow();
    });

    it('assertLocalStorageKey validates object value', () => {
      const obj = { foo: 'bar' };
      seedLocalStorage({ testKey: obj });

      expect(() => assertLocalStorageKey('testKey', obj)).not.toThrow();
    });

    it('assertLocalStorageKey throws on value mismatch', () => {
      seedLocalStorage({ testKey: 'actualValue' });

      expect(() => assertLocalStorageKey('testKey', 'expectedValue')).toThrow(/Expected localStorage key "testKey" to have value/);
    });
  });

  describe('Tauri bridge mock', () => {
    beforeEach(() => {
      clearTauriMock();
    });

    it('setupTauriMockForTests creates window.__TAURI__', () => {
      setupTauriMockForTests();

      expect((window as any).__TAURI__).toBeDefined();
      expect((window as any).__TAURI__.core.invoke).toBeDefined();
      expect((window as any).__TAURI__.event.listen).toBeDefined();
    });

    it('clearTauriMock removes window.__TAURI__', () => {
      setupTauriMockForTests();
      clearTauriMock();

      expect((window as any).__TAURI__).toBeUndefined();
    });

    it('mockTauriBridge creates mock with defaults', () => {
      const mock = mockTauriBridge();

      expect(mock.invoke).toBeDefined();
      expect(mock.listen).toBeDefined();
      expect(mock.isTauriRuntime).toBeDefined();
      expect(mock.getProfilesDirectory).toBeDefined();
      expect(mock.ensureDirectory).toBeDefined();
    });

    it('mockTauriBridge accepts custom implementations', () => {
      const customInvoke = vi.fn().mockResolvedValue('custom-result');
      const mock = mockTauriBridge({ invoke: customInvoke });

      expect(mock.invoke).toBe(customInvoke);
    });

    it('mock functions return expected defaults', async () => {
      const mock = mockTauriBridge();

      const invokeResult = await mock.invoke();
      expect(invokeResult).toBeNull();
      
      const listenResult = await mock.listen();
      expect(typeof listenResult).toBe('function');
      
      expect(mock.isTauriRuntime()).toBe(false);
      
      const profilesDir = await mock.getProfilesDirectory();
      expect(profilesDir).toBe('C:\\test\\profiles');
      
      const ensureResult = await mock.ensureDirectory();
      expect(ensureResult).toBeUndefined();
    });
  });

  describe('Integration: localStorage + render', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('component can read seeded localStorage', () => {
      seedLocalStorage({ testData: { value: 123 } });

      const TestComponent = () => {
        const data = localStorage.getItem('testData');
        return <div data-testid="data">{data}</div>;
      };

      renderWithProviders(<TestComponent />);

      const dataElement = screen.getByTestId('data');
      expect(dataElement.textContent).toBe(JSON.stringify({ value: 123 }));
    });

    it('component writes can be asserted', async () => {
      const TestComponent = () => {
        const handleClick = () => {
          localStorage.setItem('clicked', 'true');
        };
        return <button onClick={handleClick}>Click</button>;
      };

      renderWithProviders(<TestComponent />);

      const button = screen.getByRole('button');
      button.click();

      await waitFor(() => {
        assertLocalStorageKey('clicked', 'true');
      });
    });
  });
});
