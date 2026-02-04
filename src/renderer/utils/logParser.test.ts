import { describe, it, expect } from 'vitest';
import {
  parseLogFile,
  filterLogEntries,
  extractUniqueNamespaces,
  extractLogLevels,
} from './logParser';
import { LogEntry, LogLevel, LogSchema } from '../types/log';

describe('logParser', () => {
  describe('parseLogFile', () => {
    it('should parse a single log entry correctly', () => {
      const content = '2025-01-01 12:00:00.000 | INFO | Test.Namespace | Test message';
      const entries = parseLogFile(content);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        timestamp: '2025-01-01 12:00:00.000',
        level: 'INFO',
        namespace: 'Test.Namespace',
        message: 'Test message',
        originalLineNumber: 1,
        isMultiLine: false,
        lineCount: 1,
      });
    });

    it('should parse multiple log entries', () => {
      const content = `2025-01-01 12:00:00.000 | INFO | Test.Namespace | First message
2025-01-01 12:00:01.000 | ERROR | Test.Namespace | Second message
2025-01-01 12:00:02.000 | WARN | Test.Namespace | Third message`;

      const entries = parseLogFile(content);

      expect(entries).toHaveLength(3);
      expect(entries[0].level).toBe('INFO');
      expect(entries[1].level).toBe('ERROR');
      expect(entries[2].level).toBe('WARN');
    });

    it('should handle multi-line log entries', () => {
      const content = `2025-01-01 12:00:00.000 | INFO | Test.Namespace | First line
  Second line
  Third line`;

      const entries = parseLogFile(content);

      expect(entries).toHaveLength(1);
      expect(entries[0].isMultiLine).toBe(true);
      expect(entries[0].lineCount).toBe(3);
      expect(entries[0].message).toContain('First line');
      expect(entries[0].message).toContain('Second line');
      expect(entries[0].message).toContain('Third line');
    });

    it('should handle entries with different log levels', () => {
      const content = `2025-01-01 12:00:00.000 | DEBUG | Test | Debug message
2025-01-01 12:00:01.000 | INFO | Test | Info message
2025-01-01 12:00:02.000 | WARN | Test | Warning message
2025-01-01 12:00:03.000 | ERROR | Test | Error message
2025-01-01 12:00:04.000 | FATAL | Test | Fatal message`;

      const entries = parseLogFile(content);

      expect(entries).toHaveLength(5);
      expect(entries.map(e => e.level)).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);
    });

    it('should handle empty lines', () => {
      const content = `2025-01-01 12:00:00.000 | INFO | Test | Message

2025-01-01 12:00:01.000 | INFO | Test | Another message`;

      const entries = parseLogFile(content);

      expect(entries).toHaveLength(2);
    });

    it('should handle lines without pattern match', () => {
      const content = `Invalid line without pattern
2025-01-01 12:00:00.000 | INFO | Test | Valid message`;

      const entries = parseLogFile(content);

      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('UNKNOWN');
      expect(entries[1].level).toBe('INFO');
    });

    it('should respect lineOffset parameter', () => {
      const content = '2025-01-01 12:00:00.000 | INFO | Test | Message';
      const entries = parseLogFile(content, undefined, 10);

      expect(entries[0].originalLineNumber).toBe(11);
    });

    it('should handle custom schema', () => {
      const customSchema: LogSchema = {
        pattern: '^(\\d{4}-\\d{2}-\\d{2})\\s+(\\w+)\\s+(.+)$',
        timestampFormat: 'YYYY-MM-DD',
        fields: {
          timestamp: 1,
          level: 2,
          namespace: 3,
          message: 4,
        },
      };

      const content = '2025-01-01 INFO Test.Namespace Custom format message';
      const entries = parseLogFile(content, customSchema);

      expect(entries).toHaveLength(1);
      expect(entries[0].timestamp).toBe('2025-01-01');
      expect(entries[0].level).toBe('INFO');
    });

    it('should handle whitespace around pipe separators', () => {
      const content = '2025-01-01 12:00:00.000  |  INFO  |  Test.Namespace  |  Message with spaces';
      const entries = parseLogFile(content);

      expect(entries).toHaveLength(1);
      expect(entries[0].timestamp).toBe('2025-01-01 12:00:00.000');
      expect(entries[0].level).toBe('INFO');
      expect(entries[0].namespace).toBe('Test.Namespace');
      expect(entries[0].message).toBe('Message with spaces');
    });
  });

  describe('filterLogEntries', () => {
    const testEntries: LogEntry[] = [
      {
        originalLineNumber: 1,
        timestamp: '2025-01-01 12:00:00.000',
        level: 'INFO',
        namespace: 'App.Service',
        message: 'Info message',
        fullText: '2025-01-01 12:00:00.000 | INFO | App.Service | Info message',
        isMultiLine: false,
        lineCount: 1,
      },
      {
        originalLineNumber: 2,
        timestamp: '2025-01-01 12:00:01.000',
        level: 'ERROR',
        namespace: 'App.Service',
        message: 'Error message',
        fullText: '2025-01-01 12:00:01.000 | ERROR | App.Service | Error message',
        isMultiLine: false,
        lineCount: 1,
      },
      {
        originalLineNumber: 3,
        timestamp: '2025-01-01 12:00:02.000',
        level: 'WARN',
        namespace: 'App.Other',
        message: 'Warning message',
        fullText: '2025-01-01 12:00:02.000 | WARN | App.Other | Warning message',
        isMultiLine: false,
        lineCount: 1,
      },
      {
        originalLineNumber: 4,
        timestamp: '2025-01-01 12:00:03.000',
        level: 'DEBUG',
        namespace: 'App.Service.Sub',
        message: 'Debug message',
        fullText: '2025-01-01 12:00:03.000 | DEBUG | App.Service.Sub | Debug message',
        isMultiLine: false,
        lineCount: 1,
      },
    ];

    it('should filter by log level', () => {
      const filtered = filterLogEntries(testEntries, ['ERROR'], [], '');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe('ERROR');
    });

    it('should filter by multiple log levels', () => {
      const filtered = filterLogEntries(testEntries, ['INFO', 'ERROR'], [], '');

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.level)).toEqual(['INFO', 'ERROR']);
    });

    it('should filter by namespace (exact match)', () => {
      const filtered = filterLogEntries(testEntries, [], ['App.Service'], '');

      // Hierarchical filtering includes App.Service and App.Service.Sub
      expect(filtered.length).toBeGreaterThanOrEqual(2);
      expect(filtered.every(e => e.namespace.startsWith('App.Service'))).toBe(true);
    });

    it('should filter by namespace (hierarchical match)', () => {
      const filtered = filterLogEntries(testEntries, [], ['App.Service'], '');

      expect(filtered).toHaveLength(3); // App.Service, App.Service.Sub
      expect(filtered.some(e => e.namespace === 'App.Service')).toBe(true);
      expect(filtered.some(e => e.namespace === 'App.Service.Sub')).toBe(true);
    });

    it('should filter by search query', () => {
      const filtered = filterLogEntries(testEntries, [], [], 'Error');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe('ERROR');
    });

    it('should filter by search query (case insensitive)', () => {
      const filtered = filterLogEntries(testEntries, [], [], 'error');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe('ERROR');
    });

    it('should combine multiple filters', () => {
      const filtered = filterLogEntries(testEntries, ['INFO', 'ERROR'], ['App.Service'], 'message');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => ['INFO', 'ERROR'].includes(e.level))).toBe(true);
      expect(filtered.every(e => e.namespace.startsWith('App.Service'))).toBe(true);
    });

    it('should return all entries when no filters are applied', () => {
      const filtered = filterLogEntries(testEntries, [], [], '');

      expect(filtered).toHaveLength(4);
    });
  });

  describe('extractUniqueNamespaces', () => {
    it('should extract unique namespaces from entries', () => {
      const entries: LogEntry[] = [
        {
          originalLineNumber: 1,
          timestamp: '',
          level: 'INFO',
          namespace: 'App.Service',
          message: '',
          fullText: '',
          isMultiLine: false,
          lineCount: 1,
        },
        {
          originalLineNumber: 2,
          timestamp: '',
          level: 'INFO',
          namespace: 'App.Other',
          message: '',
          fullText: '',
          isMultiLine: false,
          lineCount: 1,
        },
        {
          originalLineNumber: 3,
          timestamp: '',
          level: 'INFO',
          namespace: 'App.Service',
          message: '',
          fullText: '',
          isMultiLine: false,
          lineCount: 1,
        },
      ];

      const namespaces = extractUniqueNamespaces(entries);

      expect(namespaces).toHaveLength(2);
      expect(namespaces).toContain('App.Service');
      expect(namespaces).toContain('App.Other');
      expect(namespaces).toEqual(['App.Other', 'App.Service']); // Sorted
    });

    it('should return empty array for empty entries', () => {
      const namespaces = extractUniqueNamespaces([]);

      expect(namespaces).toHaveLength(0);
    });
  });

  describe('extractLogLevels', () => {
    it('should extract unique log levels from entries', () => {
      const entries: LogEntry[] = [
        {
          originalLineNumber: 1,
          timestamp: '',
          level: 'INFO',
          namespace: '',
          message: '',
          fullText: '',
          isMultiLine: false,
          lineCount: 1,
        },
        {
          originalLineNumber: 2,
          timestamp: '',
          level: 'ERROR',
          namespace: '',
          message: '',
          fullText: '',
          isMultiLine: false,
          lineCount: 1,
        },
        {
          originalLineNumber: 3,
          timestamp: '',
          level: 'INFO',
          namespace: '',
          message: '',
          fullText: '',
          isMultiLine: false,
          lineCount: 1,
        },
      ];

      const levels = extractLogLevels(entries);

      expect(levels).toHaveLength(2);
      expect(levels).toContain('INFO');
      expect(levels).toContain('ERROR');
      expect(levels).toEqual(['ERROR', 'INFO']); // Sorted
    });

    it('should return empty array for empty entries', () => {
      const levels = extractLogLevels([]);

      expect(levels).toHaveLength(0);
    });
  });
});
