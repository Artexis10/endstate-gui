import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isTidewaveEnabled =
  process.env.NODE_ENV === 'development' &&
  process.env.TIDEWAVE_ENABLED === '1';

export default defineConfig(async () => ({
  plugins: [
    react(),
    ...(isTidewaveEnabled
      ? [(await import('tidewave/vite-plugin')).default()]
      : []),
  ],

  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  optimizeDeps: {
    exclude: ['@tauri-apps/api'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
