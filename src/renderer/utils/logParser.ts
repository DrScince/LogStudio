import { LogEntry, LogLevel, LogSchema } from '../types/log';

const DEFAULT_SCHEMA: LogSchema = {
  // Pattern: Timestamp | Level | Namespace | Message
  // Erlaubt Leerzeichen um die Pipe-Trenner
  pattern: '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d+)\\s*\\|\\s*([A-Z]+)\\s*\\|\\s*([^|]+)\\s*\\|\\s*(.+)$',
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Prüfe, ob die Zeile dem Pattern entspricht
    const match = trimmedLine.match(regex);

    if (match) {
      // Neue Log-Zeile gefunden - speichere vorherigen Eintrag
      if (currentEntry) {
        entries.push(currentEntry);
      }

      // Extrahiere und trimme die Felder
      const timestamp = (match[schema.fields.timestamp] || '').trim();
      const level = (match[schema.fields.level] || 'INFO').trim().toUpperCase() as LogLevel;
      const namespace = (match[schema.fields.namespace] || '').trim();
      const message = (match[schema.fields.message] || '').trim();

      // Debugging: Logge erste paar Einträge
      if (entries.length < 3) {
        console.log(`Parsed entry ${i + 1}:`, {
          timestamp,
          level,
          namespace,
          message: message.substring(0, 50) + '...',
          matchGroups: match.slice(1),
        });
      }

      currentEntry = {
        originalLineNumber: i + 1,
        timestamp,
        level,
        namespace,
        message,
        fullText: line,
        isMultiLine: false,
        lineCount: 1,
      };
    } else if (currentEntry) {
      // Fortsetzung einer mehrzeiligen Log-Nachricht
      // Füge die Zeile hinzu, auch wenn sie leer ist (für Stack Traces wichtig)
      currentEntry.fullText += '\n' + line;
      if (line.trim()) {
        currentEntry.message += '\n' + line;
      } else {
        // Leere Zeile in mehrzeiligen Einträgen beibehalten
        currentEntry.message += '\n';
      }
      currentEntry.isMultiLine = true;
      currentEntry.lineCount++;
    } else if (trimmedLine) {
      // Zeile ohne Pattern und ohne vorherigen Eintrag - erstelle Fallback-Eintrag
      entries.push({
        originalLineNumber: i + 1,
        timestamp: '',
        level: 'UNKNOWN' as LogLevel,
        namespace: '',
        message: line,
        fullText: line,
        isMultiLine: false,
        lineCount: 1,
      });
    }
    // Leere Zeilen ohne vorherigen Eintrag werden ignoriert
  }

  // Speichere letzten Eintrag
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

    // Hierarchischer Namespace-Filter
    // Wenn ein Namespace ausgewählt ist, werden alle untergeordneten Namespaces mit einbezogen
    if (namespaceFilter.length > 0) {
      const matches = namespaceFilter.some((filterNamespace) => {
        // Exakter Match
        if (entry.namespace === filterNamespace) {
          return true;
        }
        // Hierarchischer Match: Entry-Namespace beginnt mit Filter-Namespace + "."
        if (entry.namespace.startsWith(filterNamespace + '.')) {
          return true;
        }
        return false;
      });
      
      if (!matches) {
        return false;
      }
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
