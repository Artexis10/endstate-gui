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
      ],
      thresholds: {
        lines: 70,
        functions: 55,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
