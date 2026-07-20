import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/vite-env.d.ts',
        'src-tauri/**',
        'e2e/**',
        'src/**/index.ts',
        'src/lib/tauri-bridge.ts',
        'src/lib/http-bridge.ts',
        'src/lib/clipboard.ts',
        // App is exercised by integration tests and Playwright. It was never part
        // of the unit baseline until the native-drop integration test imported it.
        'src/App.tsx',
        // E2E scaffolding, not product code. The sibling `e2e/**` directory is
        // already excluded above; src/e2e/ holds the mock engine only because it
        // must be bundled into the dev build for Playwright to reach it. Its
        // correctness is enforced by mock-engine.conformance.test.ts against a
        // fixture captured from the real engine — a stronger guarantee than line
        // coverage of a hand-written stub.
        'src/e2e/**',
        // Sole consumer is src/e2e/mock-engine.ts (event replay for Playwright
        // fixtures); nothing in the app imports it. It entered the coverage
        // denominator at 0% only because the mock conformance test imports the
        // mock, and v8 instruments whatever gets loaded — including a module's
        // whole transitive graph.
        'src/lib/event-replay.ts',
      ],
      thresholds: {
        lines: 78,
        functions: 70,
        branches: 68,
        statements: 76,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
