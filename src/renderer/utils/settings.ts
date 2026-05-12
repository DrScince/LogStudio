import { LogSchema } from '../types/log';
import { Language, detectLanguage } from '../i18n/constants';

export type { LogSchema };

const SETTINGS_KEY = 'logstudio-settings';
const DEFAULT_SCHEMA: LogSchema = {
  pattern: '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d+) \\| ([A-Z]+) \\| ([^|]+) \\| (.*)$',
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  fields: {
    timestamp: 1,
    level: 2,
    namespace: 3,
    message: 4,
  },
};

export type EditorId = 'vscode' | 'notepadplusplus' | 'notepad';

export interface HotkeyBinding {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;      // KeyboardEvent.key value
  chord?: boolean;  // second key of Ctrl+K chord (modifiers ignored)
}

export type HotkeyId =
  | 'save'
  | 'format'
  | 'comment'
  | 'uncomment'
  | 'cutLine'
  | 'moveLineUp'
  | 'moveLineDown';

export type HotkeyMap = Record<HotkeyId, HotkeyBinding>;

export const DEFAULT_HOTKEYS: HotkeyMap = {
  save:         { ctrl: true,  alt: false, shift: false, key: 's' },
  format:       { ctrl: false, alt: false, shift: false, key: 'd', chord: true },
  comment:      { ctrl: false, alt: false, shift: false, key: 'c', chord: true },
  uncomment:    { ctrl: false, alt: false, shift: false, key: 'u', chord: true },
  cutLine:      { ctrl: false, alt: false, shift: true,  key: 'Delete' },
  moveLineUp:   { ctrl: false, alt: true,  shift: false, key: 'ArrowUp' },
  moveLineDown: { ctrl: false, alt: true,  shift: false, key: 'ArrowDown' },
};

export interface AppSettings {
  logSchema: LogSchema;
  logDirectory: string;         // kept for migration; use logDirectories
  logDirectories: string[];     // ordered list of watched directories
  autoRefresh: boolean;
  refreshInterval: number;
  fontSize: number;
  theme: 'dark' | 'light';
  editorOrder: EditorId[];
  language: Language;
  autoDetect: boolean;
  enabledFormats: string[];
  includeSubdirectories: boolean;
  hotkeys: HotkeyMap;
}

const DEFAULT_SETTINGS: AppSettings = {
  logSchema: DEFAULT_SCHEMA,
  logDirectory: '',
  logDirectories: [],
  autoRefresh: true,
  refreshInterval: 1000,
  fontSize: 12,
  theme: 'dark',
  editorOrder: ['vscode', 'notepadplusplus', 'notepad'],
  language: detectLanguage(),
  autoDetect: true,
  enabledFormats: ['pipe', 'log4j', 'json', 'logfmt', 'syslog', 'apache', 'german'],
  includeSubdirectories: false,
  hotkeys: DEFAULT_HOTKEYS,
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const base: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // Deep merge hotkeys so newly added actions get their defaults
        hotkeys: { ...DEFAULT_HOTKEYS, ...(parsed.hotkeys ?? {}) },
        logDirectories: parsed.logDirectories ?? [],
      };
      // Migration: legacy single logDirectory → logDirectories list
      if (base.logDirectory && base.logDirectories.length === 0) {
        base.logDirectories = [base.logDirectory];
      }
      return base;
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
