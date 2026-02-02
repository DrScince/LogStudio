import { LogEntry, LogLevel, LogSchema } from '../types/log';

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

export function parseLogFile(content: string, schema: LogSchema = DEFAULT_SCHEMA): LogEntry[] {
  const lines = content.split('\n');
  const entries: LogEntry[] = [];
  const regex = new RegExp(schema.pattern);

  let currentEntry: LogEntry | null = null;
  let originalLineNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(regex);

    if (match) {
      // Neue Log-Zeile gefunden
      if (currentEntry) {
        entries.push(currentEntry);
      }

      currentEntry = {
        originalLineNumber,
        timestamp: match[schema.fields.timestamp] || '',
        level: (match[schema.fields.level] || 'INFO') as LogLevel,
        namespace: match[schema.fields.namespace] || '',
        message: match[schema.fields.message] || '',
        fullText: line,
        isMultiLine: false,
        lineCount: 1,
      };
      originalLineNumber = i + 1;
    } else if (currentEntry && line.trim()) {
      // Fortsetzung einer mehrzeiligen Log-Nachricht
      currentEntry.fullText += '\n' + line;
      currentEntry.message += '\n' + line;
      currentEntry.isMultiLine = true;
      currentEntry.lineCount++;
    } else if (currentEntry && !line.trim()) {
      // Leere Zeile - Ende des Eintrags
      entries.push(currentEntry);
      currentEntry = null;
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

export function filterLogEntries(
  entries: LogEntry[],
  levelFilter: LogLevel[],
  namespaceFilter: string[],
  searchQuery: string
): LogEntry[] {
  return entries.filter((entry) => {
    // Level-Filter
    if (levelFilter.length > 0 && !levelFilter.includes(entry.level)) {
      return false;
    }

    // Namespace-Filter
    if (namespaceFilter.length > 0 && !namespaceFilter.includes(entry.namespace)) {
      return false;
    }

    // Suchfilter
    if (searchQuery && !entry.fullText.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });
}

export function extractUniqueNamespaces(entries: LogEntry[]): string[] {
  const namespaces = new Set<string>();
  entries.forEach((entry) => namespaces.add(entry.namespace));
  return Array.from(namespaces).sort();
}

export function extractLogLevels(entries: LogEntry[]): LogLevel[] {
  const levels = new Set<LogLevel>();
  entries.forEach((entry) => levels.add(entry.level));
  return Array.from(levels).sort();
}
