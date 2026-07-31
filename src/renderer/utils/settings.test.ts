import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSettings, saveSettings, AppSettings } from './settings';

describe('settings', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('loadSettings', () => {
    it('should return default settings when localStorage is empty', () => {
      const settings = loadSettings();

      expect(settings).toMatchObject({
        logDirectory: '',
        logDirectories: [],
        directoryMeta: {},
        autoRefresh: true,
        refreshInterval: 1000,
        fontSize: 12,
        theme: 'dark',
      });
      expect(settings.workspaces.length).toBeGreaterThanOrEqual(1);
      expect(settings.activeWorkspaceId).toBeTruthy();
      expect(settings.logSchema).toBeDefined();
      expect(settings.logSchema.pattern).toBeDefined();
    });

    it('should migrate legacy settings into a workspace on load', () => {
      localStorage.setItem(
        'logstudio-settings',
        JSON.stringify({
          logDirectories: ['/legacy/logs'],
          fontSize: 14,
        })
      );
      const loaded = loadSettings();
      expect(loaded.workspaces).toHaveLength(1);
      expect(loaded.workspaces[0].logDirectories).toEqual(['/legacy/logs']);
      expect(loaded.activeWorkspaceId).toBe(loaded.workspaces[0].id);
      expect(loaded.logDirectories).toEqual(['/legacy/logs']);
    });

    it('should load saved settings from localStorage', () => {
      const savedSettings: AppSettings = {
        logSchema: {
          pattern: 'test-pattern',
          timestampFormat: 'YYYY-MM-DD',
          fields: {
            timestamp: 1,
            level: 2,
            namespace: 3,
            message: 4,
          },
        },
        logDirectory: '/test/path',
        logDirectories: ['/test/path'],
        directoryMeta: {},
        autoRefresh: false,
        refreshInterval: 2000,
        fontSize: 14,
        theme: 'light',
      };

      localStorage.setItem('logstudio-settings', JSON.stringify(savedSettings));
      const loaded = loadSettings();

      expect(loaded).toMatchObject(savedSettings);
    });

    it('should merge saved settings with defaults', () => {
      const partialSettings = {
        logDirectory: '/custom/path',
        fontSize: 16,
      };

      localStorage.setItem('logstudio-settings', JSON.stringify(partialSettings));
      const loaded = loadSettings();

      expect(loaded.logDirectory).toBe('/custom/path');
      expect(loaded.fontSize).toBe(16);
      expect(loaded.autoRefresh).toBe(true); // Default value
      expect(loaded.theme).toBe('dark'); // Default value
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('logstudio-settings', 'invalid-json');
      
      // Should not throw, should return defaults
      const settings = loadSettings();
      expect(settings).toBeDefined();
      expect(settings.logDirectory).toBe('');
    });

    it('should default directoryMeta to empty object when missing', () => {
      localStorage.setItem('logstudio-settings', JSON.stringify({ logDirectory: '/x' }));
      const loaded = loadSettings();
      expect(loaded.directoryMeta).toEqual({});
    });

    it('should preserve directoryMeta from storage', () => {
      localStorage.setItem(
        'logstudio-settings',
        JSON.stringify({
          directoryMeta: {
            '/logs': { label: 'Prod', icon: 'server', color: 'blue' },
          },
        })
      );
      const loaded = loadSettings();
      expect(loaded.directoryMeta['/logs']).toEqual({
        label: 'Prod',
        icon: 'server',
        color: 'blue',
      });
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', () => {
      const settings: AppSettings = {
        logSchema: {
          pattern: 'test-pattern',
          timestampFormat: 'YYYY-MM-DD',
          fields: {
            timestamp: 1,
            level: 2,
            namespace: 3,
            message: 4,
          },
        },
        logDirectory: '/test/path',
        logDirectories: [],
        directoryMeta: {},
        autoRefresh: false,
        refreshInterval: 2000,
        fontSize: 14,
        theme: 'light',
      };

      saveSettings(settings);

      const saved = localStorage.getItem('logstudio-settings');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed).toMatchObject(settings);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const settings: AppSettings = {
        logSchema: {
          pattern: 'test',
          timestampFormat: 'YYYY-MM-DD',
          fields: {
            timestamp: 1,
            level: 2,
            namespace: 3,
            message: 4,
          },
        },
        logDirectory: '',
        logDirectories: [],
        directoryMeta: {},
        autoRefresh: true,
        refreshInterval: 1000,
        fontSize: 12,
        theme: 'dark',
      };

      // Should not throw
      expect(() => saveSettings(settings)).not.toThrow();

      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });
});
