/** Mirrors src/renderer/utils/aiLogContext.ts — keep patterns in sync. */
export const ERROR_LINE_RE =
  /\b(ERROR|FATAL|CRITICAL|EXCEPTION|FAIL(?:ED|URE)?|PANIC|SEVERE|WARN(?:ING)?)\b|Exception:|Error:|ECONN|ENOENT|ETIMEDOUT|HTTP\/?\s*[45]\d\d|status[=: ][45]\d\d/i;

export const FATAL_LINE_RE = /\b(FATAL|CRITICAL|PANIC)\b/i;

export interface LogLineMatch {
  lineNumber: number;
  text: string;
}

export interface LogSearchResult {
  lineNumber: number;
  text: string;
}

function joinSelected(lines: string[], indexes: number[]): string {
  const unique = [...new Set(indexes)].sort((a, b) => a - b);
  return unique.map((i) => lines[i]).join('\n');
}

function addWindow(keep: Set<number>, index: number, last: number, nearby: number) {
  for (let j = Math.max(0, index - nearby); j <= Math.min(last, index + nearby); j++) {
    keep.add(j);
  }
}

export function splitLogLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n');
  if (normalized.length === 0) return [];
  return normalized.split('\n');
}

/** Prefer error/warn lines so agents see failures, not only the file tail. */
export function buildLogFileExcerpt(
  content: string,
  maxChars = 28000
): { excerpt: string; truncated: boolean; lineCount: number; totalLines: number } {
  const lines = splitLogLines(content);
  const totalLines = lines.length;
  const normalized = lines.join('\n');
  if (normalized.length <= maxChars) {
    return { excerpt: normalized, truncated: false, lineCount: lines.length, totalLines };
  }

  const last = lines.length - 1;
  const interestingIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (ERROR_LINE_RE.test(lines[i])) interestingIdx.push(i);
  }

  const keep = new Set<number>();
  const nearby = 2;
  const recentInteresting = interestingIdx.slice(-120);
  for (const i of recentInteresting) addWindow(keep, i, last, nearby);

  for (let i = 0; i < Math.min(8, lines.length); i++) keep.add(i);
  for (let i = Math.max(0, lines.length - 12); i < lines.length; i++) keep.add(i);

  let excerpt = joinSelected(lines, [...keep]);
  if (excerpt.length > maxChars) {
    const must = new Set<number>();
    for (const i of interestingIdx.slice(-40)) addWindow(must, i, last, 1);
    for (let i = Math.max(0, lines.length - 8); i < lines.length; i++) must.add(i);
    excerpt = joinSelected(lines, [...must]);
    if (excerpt.length > maxChars) excerpt = excerpt.slice(-maxChars);
  }

  if (!excerpt.trim()) {
    excerpt = normalized.slice(-maxChars);
    const firstNl = excerpt.indexOf('\n');
    if (firstNl > 0 && firstNl < 200) excerpt = excerpt.slice(firstNl + 1);
  }

  return {
    excerpt,
    truncated: true,
    lineCount: excerpt.split('\n').length,
    totalLines,
  };
}

export function listMatchingLines(
  content: string,
  predicate: (line: string) => boolean,
  options: { maxResults?: number; contextLines?: number } = {}
): LogLineMatch[] {
  const { maxResults = 200, contextLines = 0 } = options;
  const lines = splitLogLines(content);
  const matches: LogLineMatch[] = [];
  const emitted = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (!predicate(lines[i])) continue;
    const start = Math.max(0, i - contextLines);
    const end = Math.min(lines.length - 1, i + contextLines);
    for (let j = start; j <= end; j++) {
      if (emitted.has(j)) continue;
      emitted.add(j);
      matches.push({ lineNumber: j + 1, text: lines[j] });
      if (matches.length >= maxResults) return matches;
    }
  }

  return matches;
}

export function listErrors(content: string, maxResults = 200, contextLines = 0): LogLineMatch[] {
  return listMatchingLines(content, (line) => ERROR_LINE_RE.test(line), { maxResults, contextLines });
}

export function listFatalErrors(content: string, maxResults = 200, contextLines = 0): LogLineMatch[] {
  return listMatchingLines(content, (line) => FATAL_LINE_RE.test(line), { maxResults, contextLines });
}

export function searchLog(
  content: string,
  query: string,
  options: { caseSensitive?: boolean; regex?: boolean; maxResults?: number } = {}
): LogSearchResult[] {
  const { caseSensitive = false, regex = false, maxResults = 200 } = options;
  const lines = splitLogLines(content);
  const results: LogSearchResult[] = [];

  let matcher: (line: string) => boolean;
  if (regex) {
    const flags = caseSensitive ? '' : 'i';
    const re = new RegExp(query, flags);
    matcher = (line) => re.test(line);
  } else {
    const needle = caseSensitive ? query : query.toLowerCase();
    matcher = (line) => {
      const hay = caseSensitive ? line : line.toLowerCase();
      return hay.includes(needle);
    };
  }

  for (let i = 0; i < lines.length; i++) {
    if (!matcher(lines[i])) continue;
    results.push({ lineNumber: i + 1, text: lines[i] });
    if (results.length >= maxResults) break;
  }

  return results;
}

export function readLineRange(
  content: string,
  startLine: number,
  endLine: number
): { lines: LogLineMatch[]; totalLines: number } {
  const all = splitLogLines(content);
  const start = Math.max(1, startLine);
  const end = Math.min(all.length, endLine);
  const lines: LogLineMatch[] = [];
  for (let i = start; i <= end; i++) {
    lines.push({ lineNumber: i, text: all[i - 1] });
  }
  return { lines, totalLines: all.length };
}

export function formatMatches(matches: LogLineMatch[]): string {
  if (matches.length === 0) return 'No matching lines found.';
  return matches.map((m) => `${m.lineNumber}: ${m.text}`).join('\n');
}
