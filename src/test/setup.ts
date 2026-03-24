import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global i18n mock — makes useTranslation() return real English translations in all tests
vi.mock('../renderer/i18n', async () => {
  const { default: en } = await import('../renderer/i18n/en');

  function resolvePath(obj: any, path: string): any {
    return path.split('.').reduce((acc: any, part: string) => acc?.[part], obj);
  }

  function interpolate(str: string, vars?: Record<string, any>): string {
    if (!vars || typeof str !== 'string') return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
  }

  return {
    useTranslation: () => ({
      t: (key: string, vars?: Record<string, any>) => {
        const value = resolvePath(en, key);
        return typeof value === 'string' ? interpolate(value, vars) : key;
      },
      language: 'en' as const,
      setLanguage: vi.fn(),
    }),
    I18nProvider: ({ children }: { children: any }) => children,
    detectLanguage: () => 'en' as const,
    LANGUAGE_LABELS: { en: 'English', de: 'Deutsch', pl: 'Polski', ro: 'Română', es: 'Español' },
  };
});

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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
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
