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
        // The mock engine Playwright drives. src/main.tsx imports it, so it ships
        // in the production bundle; main.tsx installs it only in E2E mode (see
        // isE2EMode). The sibling `e2e/**` directory is already excluded above.
        // Its correctness is enforced by mock-engine.conformance.test.ts against a
        // fixture captured from the real engine — a stronger guarantee than line
        // coverage of a hand-written stub.
        'src/e2e/**',
        // Sole consumer is src/e2e/mock-engine.ts (event replay for Playwright
        // fixtures). It entered the coverage
        // denominator at 0% only because the mock conformance test imports the
        // mock, and v8 instruments whatever gets loaded — including a module's
        // whole transitive graph.
        'src/lib/event-replay.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
