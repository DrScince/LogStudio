/**
 * Automatic log format detection and parsing.
 *
 * Supported formats:
 *   pipe-separated  – YYYY-MM-DD HH:mm:ss.SSS | LEVEL | Namespace | Message  (LogStudio default)
 *   log4j           – YYYY-MM-DD,ms LEVEL [thread] class - Message
 *   iso-simple      – YYYY-MM-DDThh:mm:ssZ LEVEL Service Message
 *   json-ecs        – {"@timestamp":"…","log.level":"…","message":"…",…}
 *   logfmt          – time=… level=… service=… msg="…"
 *   syslog-rfc5424  – <PRI>1 TIMESTAMP HOST APP PID MSGID [SD] MSG
 *   syslog-rfc3164  – <PRI>Mon DD HH:mm:ss host app[pid]: msg
 *   apache-combined – IP - user [date] "METHOD URL HTTP/x" status bytes
 *   german-date     – DD.MM.YYYY HH:mm:ss … (with indented continuation lines)
 *   generic         – Any line starting with an ISO timestamp + optional level keyword
 */

import { LogEntry, LogLevel } from '../types/log';

// ─── Public types ─────────────────────────────────────────────────────────────

export type FormatName =
  | 'pipe-separated'
  | 'log4j'
  | 'iso-simple'
  | 'json-ecs'
  | 'logfmt'
  | 'syslog-rfc5424'
  | 'syslog-rfc3164'
  | 'apache-combined'
  | 'german-date'
  | 'generic';

export interface DetectedFormat {
  name: FormatName;
  displayName: string;
  confidence: number; // 0–1
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeLevel(raw: string): LogLevel {
  const u = raw.toUpperCase().trim();
  if (u === 'WARNING') return 'WARN';
  if (u === 'CRITICAL' || u === 'SEVERE') return 'ERROR';
  if (u === 'NOTICE') return 'INFO';
  if (((['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'TRACE'] as string[]).includes(u))) {
    return u as LogLevel;
  }
  return 'INFO';
}

function inferLevelFromText(text: string): LogLevel {
  const l = text.toLowerCase();
  if (/exception|fehler|error|failed|denied|fatal|invalid|kritisch/.test(l)) return 'ERROR';
  if (/warn|warning/.test(l)) return 'WARN';
  if (/debug/.test(l)) return 'DEBUG';
  return 'INFO';
}

const MONTH_ABBR: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// Syslog priority value (lower 3 bits = severity) → LogLevel
function syslogPriToLevel(pri: string): LogLevel {
  const severity = parseInt(pri, 10) & 0x7;
  if (severity <= 1) return 'FATAL';
  if (severity <= 3) return 'ERROR';
  if (severity === 4) return 'WARN';
  if (severity <= 6) return 'INFO';
  return 'DEBUG';
}

// Apache status code → LogLevel
function httpStatusToLevel(status: string): LogLevel {
  const code = parseInt(status, 10);
  if (code >= 500) return 'ERROR';
  if (code >= 400) return 'WARN';
  return 'INFO';
}

// ─── Per-format regexes ───────────────────────────────────────────────────────

const RE = {
  pipeSep: /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d+)\s*\|\s*([A-Z]+)\s*\|\s*([^|]+?)\s*\|\s*(.*)/,
  log4j:   /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]\d*)\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|TRACE)\s+\[([^\]]+)\]\s+([\w.$/#-]+)\s+-\s+(.*)/,
  isoSim:  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z))\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|TRACE|WARNING)\s+(\S+)\s+(.*)/,
  jsonLine:/^\s*\{.*"(?:@timestamp|timestamp|time)"\s*:/,
  logfmt:  /^(?:ts|time)=(\S+)\s+level=(\S+)/,
  sys5424: /^<(\d+)>1\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+(?:\s+\[.*?\])?\s*(.*)/s,
  sys3164: /^<(\d+)>(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?\s*:\s*(.*)/,
  apache:  /^(\S+) \S+ (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+)/,
  german:  /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})\s*(.*)/,
  genTs:   /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|TRACE|WARNING)?\s*(.*)/,
};

// ─── Detection ────────────────────────────────────────────────────────────────

/** Maps format group keys (from settings) to the FormatNames they cover. */
const FORMAT_GROUP_MAP: Record<string, FormatName[]> = {
  pipe:   ['pipe-separated', 'iso-simple', 'generic'],
  log4j:  ['log4j'],
  json:   ['json-ecs'],
  logfmt: ['logfmt'],
  syslog: ['syslog-rfc5424', 'syslog-rfc3164'],
  apache: ['apache-combined'],
  german: ['german-date'],
};

function scoreLines(lines: string[], re: RegExp): number {
  const nonEmpty = lines.filter((l) => l.trim()).length;
  if (nonEmpty === 0) return 0;
  return lines.filter((l) => l.trim() && re.test(l)).length / nonEmpty;
}

/**
 * Analyse the first 100 lines and return the best matching format.
 * @param enabledFormatGroups Optional list of format group keys (from settings).
 *   When omitted all formats are tried.
 */
export function detectLogFormat(content: string, enabledFormatGroups?: string[]): DetectedFormat {
  const sampleLines = content.split('\n').slice(0, 100);

  const allCandidates: [RegExp, FormatName, string][] = [
    [RE.pipeSep,  'pipe-separated',  'Pipe-Separated'     ],
    [RE.log4j,    'log4j',           'Log4j / Logback'    ],
    [RE.isoSim,   'iso-simple',      'ISO Timestamp'      ],
    [RE.jsonLine, 'json-ecs',        'JSON / ECS'         ],
    [RE.logfmt,   'logfmt',          'Logfmt'             ],
    [RE.sys5424,  'syslog-rfc5424',  'Syslog RFC 5424'    ],
    [RE.sys3164,  'syslog-rfc3164',  'Syslog RFC 3164'    ],
    [RE.apache,   'apache-combined', 'Apache / Nginx'     ],
    [RE.german,   'german-date',     'Custom (DD.MM.YYYY)'],
  ];

  // Build set of allowed FormatNames from the enabled groups
  let allowedNames: Set<FormatName> | null = null;
  if (enabledFormatGroups && enabledFormatGroups.length > 0) {
    allowedNames = new Set<FormatName>();
    for (const groupKey of enabledFormatGroups) {
      for (const name of (FORMAT_GROUP_MAP[groupKey] ?? [])) {
        allowedNames.add(name);
      }
    }
    // Always allow generic as final fallback
    allowedNames.add('generic');
  }

  const candidates = allowedNames
    ? allCandidates.filter(([, name]) => allowedNames!.has(name))
    : allCandidates;

  let bestScore = 0;
  let best: DetectedFormat = { name: 'generic', displayName: 'Generic', confidence: 0 };

  for (const [re, name, displayName] of candidates) {
    const score = scoreLines(sampleLines, re);
    if (score > bestScore) {
      bestScore = score;
      best = { name, displayName, confidence: score };
    }
  }

  return best;
}

// ─── Entry builder (shared across all parsers) ────────────────────────────────

interface RawEntry {
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
}

/**
 * Iterates over `lines`, calls `parseLine` for each line.
 * - A non-null return value starts a new LogEntry.
 * - A null return value appends the line to the current entry (multi-line).
 */
function buildLogEntries(
  lines: string[],
  parseLine: (line: string) => RawEntry | null,
  lineOffset: number,
): LogEntry[] {
  const entries: LogEntry[] = [];
  let cur: { raw: RawEntry; startLine: number; continuations: string[] } | null = null;

  const flush = () => {
    if (!cur) return;
    const isMultiLine = cur.continuations.length > 0;
    entries.push({
      originalLineNumber: cur.startLine,
      timestamp: cur.raw.timestamp,
      level: cur.raw.level,
      namespace: cur.raw.namespace,
      message: cur.raw.message,
      fullText: isMultiLine
        ? [cur.raw.message, ...cur.continuations].join('\n')
        : cur.raw.message,
      isMultiLine,
      lineCount: 1 + cur.continuations.length,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseLine(line);
    if (parsed) {
      flush();
      cur = { raw: parsed, startLine: i + 1 + lineOffset, continuations: [] };
    } else if (cur && line.trim()) {
      cur.continuations.push(line);
    }
    // Blank lines that have no current entry are silently skipped.
  }
  flush();
  return entries;
}

// ─── Individual format parsers ────────────────────────────────────────────────

function parsePipeSep(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.pipeSep.exec(line);
    if (!m) return null;
    return {
      timestamp: m[1].trim(),
      level: normalizeLevel(m[2]),
      namespace: m[3].trim(),
      message: m[4].trim(),
    };
  }, lo);
}

function parseLog4j(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.log4j.exec(line);
    if (!m) return null;
    // m[3]=thread, m[4]=logger class; use class name as namespace
    return {
      timestamp: m[1].trim(),
      level: normalizeLevel(m[2]),
      namespace: m[4].trim(),
      message: m[5].trim(),
    };
  }, lo);
}

function parseIsoSimple(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.isoSim.exec(line);
    if (!m) return null;
    return {
      timestamp: m[1],
      level: normalizeLevel(m[2]),
      namespace: m[3],
      message: m[4].trim(),
    };
  }, lo);
}

function parseJsonEcs(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const timestamp = String(
        obj['@timestamp'] ?? obj['timestamp'] ?? obj['time'] ?? '',
      );
      const rawLevel = String(
        obj['log.level'] ?? obj['level'] ?? obj['severity'] ?? 'INFO',
      );
      const namespace = String(
        obj['log.logger'] ?? obj['logger'] ?? obj['service.name'] ??
        obj['service'] ?? obj['source'] ?? '',
      );
      const message = String(obj['message'] ?? obj['msg'] ?? '');
      return { timestamp, level: normalizeLevel(rawLevel), namespace, message };
    } catch {
      return null;
    }
  }, lo);
}

/** Parse a Logfmt line into a key→value map. */
function parseLogfmtKV(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Matches:  key="value with spaces"   or   key=plain_value
  const re = /([\w.]+)=(?:"((?:[^"\\]|\\.)*)"|(\S*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    result[m[1]] = m[2] !== undefined ? m[2].replace(/\\"/g, '"') : m[3];
  }
  return result;
}

function parseLogfmt(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    if (!RE.logfmt.test(line)) return null;
    const kv = parseLogfmtKV(line);
    return {
      timestamp: kv['ts'] ?? kv['time'] ?? '',
      level: normalizeLevel(kv['level'] ?? 'INFO'),
      namespace: kv['service'] ?? kv['logger'] ?? kv['component'] ?? kv['caller'] ?? '',
      message: kv['msg'] ?? kv['message'] ?? '',
    };
  }, lo);
}

function parseSyslog5424(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.sys5424.exec(line);
    if (!m) return null;
    return {
      timestamp: m[2],
      level: syslogPriToLevel(m[1]),
      namespace: `${m[4]}[${m[5]}]`,
      message: m[6].trim(),
    };
  }, lo);
}

function parseSyslog3164(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.sys3164.exec(line);
    if (!m) return null;
    const pid = m[5] ? `[${m[5]}]` : '';
    return {
      timestamp: m[2].trim(),
      level: syslogPriToLevel(m[1]),
      namespace: `${m[4]}${pid}`,
      message: m[6].trim(),
    };
  }, lo);
}

function parseApache(lines: string[], lo: number): LogEntry[] {
  // Convert "19/Mar/2026:10:59:21 +0100" → "2026-03-19 10:59:21"
  const normalizeApacheTs = (raw: string): string => {
    const m = /(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})/.exec(raw);
    if (!m) return raw;
    return `${m[3]}-${MONTH_ABBR[m[2]] ?? '??'}-${m[1]} ${m[4]}`;
  };

  return buildLogEntries(lines, (line) => {
    const m = RE.apache.exec(line);
    if (!m) return null;
    // Use authenticated user if present, otherwise IP
    const namespace = m[2] !== '-' ? m[2] : m[1];
    return {
      timestamp: normalizeApacheTs(m[3]),
      level: httpStatusToLevel(m[5]),
      namespace,
      message: `${m[4]} → ${m[5]}`,
    };
  }, lo);
}

function parseGermanDate(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.german.exec(line);
    if (!m) return null;
    // Reformat DD.MM.YYYY → YYYY-MM-DD
    const timestamp = `${m[3]}-${m[2]}-${m[1]} ${m[4]}`;
    const rest = m[5].trim();
    return {
      timestamp,
      level: inferLevelFromText(rest || line),
      namespace: rest, // e.g. version string "v1.2.2"
      message: rest,
    };
  }, lo);
}

function parseGeneric(lines: string[], lo: number): LogEntry[] {
  return buildLogEntries(lines, (line) => {
    const m = RE.genTs.exec(line);
    if (!m) return null;
    const level = m[2] ? normalizeLevel(m[2]) : inferLevelFromText(m[3]);
    return {
      timestamp: m[1],
      level,
      namespace: '',
      message: m[3].trim(),
    };
  }, lo);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse `content` using the given pre-detected format. */
export function parseWithFormat(
  content: string,
  format: DetectedFormat,
  lineOffset = 0,
): LogEntry[] {
  const lines = content.split('\n');
  switch (format.name) {
    case 'pipe-separated':  return parsePipeSep(lines, lineOffset);
    case 'log4j':           return parseLog4j(lines, lineOffset);
    case 'iso-simple':      return parseIsoSimple(lines, lineOffset);
    case 'json-ecs':        return parseJsonEcs(lines, lineOffset);
    case 'logfmt':          return parseLogfmt(lines, lineOffset);
    case 'syslog-rfc5424':  return parseSyslog5424(lines, lineOffset);
    case 'syslog-rfc3164':  return parseSyslog3164(lines, lineOffset);
    case 'apache-combined': return parseApache(lines, lineOffset);
    case 'german-date':     return parseGermanDate(lines, lineOffset);
    default:                return parseGeneric(lines, lineOffset);
  }
}

/** Convenience wrapper: detect format then parse. */
export function parseLogFileAuto(
  content: string,
  lineOffset = 0,
): { entries: LogEntry[]; format: DetectedFormat } {
  const format = detectLogFormat(content);
  return { entries: parseWithFormat(content, format, lineOffset), format };
}
