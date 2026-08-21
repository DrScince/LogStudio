/** Keep recent log content within a safe prompt budget. */
export function buildLogFileExcerpt(
  content: string,
  maxChars = 24000
): { excerpt: string; truncated: boolean; lineCount: number; totalLines: number } {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.length === 0 ? [] : normalized.split('\n');
  if (normalized.length <= maxChars) {
    return {
      excerpt: normalized,
      truncated: false,
      lineCount: lines.length,
      totalLines: lines.length,
    };
  }
  let excerpt = normalized.slice(-maxChars);
  const firstNl = excerpt.indexOf('\n');
  if (firstNl > 0 && firstNl < 200) excerpt = excerpt.slice(firstNl + 1);
  return {
    excerpt,
    truncated: true,
    lineCount: excerpt.split('\n').length,
    totalLines: lines.length,
  };
}

export function fileLabelFromPath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}
