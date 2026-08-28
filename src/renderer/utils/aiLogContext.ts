const ERROR_LINE_RE =
  /\b(ERROR|FATAL|CRITICAL|EXCEPTION|FAIL(?:ED|URE)?|PANIC|SEVERE|WARN(?:ING)?)\b|Exception:|Error:|ECONN|ENOENT|ETIMEDOUT|HTTP\/?\s*[45]\d\d|status[=: ][45]\d\d/i;

function joinSelected(lines: string[], indexes: number[]): string {
  const unique = [...new Set(indexes)].sort((a, b) => a - b);
  return unique.map((i) => lines[i]).join('\n');
}

function addWindow(keep: Set<number>, index: number, last: number, nearby: number) {
  for (let j = Math.max(0, index - nearby); j <= Math.min(last, index + nearby); j++) {
    keep.add(j);
  }
}

/** Prefer error/warn lines so the model sees the failure, not only the file tail. */
export function buildLogFileExcerpt(
  content: string,
  maxChars = 28000
): { excerpt: string; truncated: boolean; lineCount: number; totalLines: number } {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.length === 0 ? [] : normalized.split('\n');
  const totalLines = lines.length;
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

  // Always keep a little head + tail so startup vs crash stay visible.
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

export function fileLabelFromPath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}
