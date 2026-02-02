import { LogSchema } from '../types/log';

const SETTINGS_KEY = 'logstudio-settings';
const DEFAULT_SCHEMA: LogSchema = {
  pattern: '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d+) \\| ([A-Z]+) \\| ([^|]+) \\| (.+)$',
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  separator: ' | ',
  fields: {
    timestamp: 1,
    level: 2,
    namespace: 3,
    message: 4,
  },
};

export interface AppSettings {
  logSchema: LogSchema;
  logDirectory: string;
  autoRefresh: boolean;
  refreshInterval: number;
  fontSize: number;
  theme: 'dark' | 'light';
}

const DEFAULT_SETTINGS: AppSettings = {
  logSchema: DEFAULT_SCHEMA,
  logDirectory: '',
  autoRefresh: true,
  refreshInterval: 1000,
  fontSize: 12,
  theme: 'dark',
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}
