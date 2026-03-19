import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/main/', // Electron main process - difficult to test
        'src/renderer/main.tsx', // Entry point - difficult to test
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        'html/', // Generated test reports
      ],
    },
    // Suppress console output in tests unless explicitly needed
    silent: false,
    onConsoleLog: (log, type) => {
      // Suppress debug logs but keep errors and warnings
      if (type === 'log' && log.includes('Parsed entry')) {
        return false; // Suppress parsing debug logs
      }
      if (type === 'log' && log.includes('LogViewer:')) {
        return false; // Suppress LogViewer debug logs
      }
      if (type === 'log' && log.includes('Loading')) {
        return false; // Suppress loading logs
      }
      if (type === 'log' && log.includes('Loaded')) {
        return false; // Suppress loaded logs
      }
      if (type === 'log' && log.includes('Tracking')) {
        return false; // Suppress tracking logs
      }
      return true; // Keep other logs
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
});
