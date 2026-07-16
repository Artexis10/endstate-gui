import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as React from 'react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const Component = React.forwardRef((props: any, ref: any) => {
          const { children, ...rest } = props;
          // Remove framer-motion specific props
          const {
            initial,
            animate,
            exit,
            variants,
            transition,
            layout,
            layoutId,
            whileHover,
            whileTap,
            ...cleanProps
          } = rest;
          return React.createElement(prop as string, { ...cleanProps, ref }, children);
        });
        Component.displayName = `motion.${String(prop)}`;
        return Component;
      },
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Radix Select relies on pointer-capture APIs that jsdom does not implement.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  localStorageMock.clear();
});

afterEach(() => {
  cleanup();
});
