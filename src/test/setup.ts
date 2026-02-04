import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
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
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    readLogFile: async (filePath: string) => ({
      success: true,
      content: '2025-01-01 12:00:00.000 | INFO | Test.Namespace | Test message',
    }),
    listLogFiles: async (directory: string) => ({
      success: true,
      files: [{ name: 'test.log', path: '/path/to/test.log' }],
    }),
    watchLogFile: () => {},
    unwatchLogFile: () => {},
    onLogFileChanged: () => {},
    removeLogFileChangedListener: () => {},
    openFileDialog: async () => ({
      canceled: false,
      filePath: '/path/to/test.log',
    }),
    readChangelog: async () => ({
      success: true,
      content: '# Changelog\n\n## [1.2.0] - 2025-02-04\n\n### Added\n- Test feature',
    }),
    getDefaultLogDirectory: async () => ({
      success: true,
      directory: '/default/log/directory',
    }),
  },
  writable: true,
});
