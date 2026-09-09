/** Lightweight file-type detection for tabs — avoid full-file reads on startup. */

export interface FileTypeFlags {
  isXml: boolean;
  isJson: boolean;
  isMarkdown: boolean;
}

export function flagsFromExtension(filePath: string): FileTypeFlags & { needsContentPeek: boolean } {
  const lp = filePath.toLowerCase();
  if (lp.endsWith('.md') || lp.endsWith('.markdown')) {
    return { isXml: false, isJson: false, isMarkdown: true, needsContentPeek: false };
  }
  if (lp.endsWith('.xml')) {
    return { isXml: true, isJson: false, isMarkdown: false, needsContentPeek: false };
  }
  if (lp.endsWith('.log') || lp.endsWith('.txt')) {
    return { isXml: false, isJson: false, isMarkdown: false, needsContentPeek: false };
  }
  if (lp.endsWith('.json')) {
    // May be a structured JSON doc or a JSON log stream — peek to decide.
    return { isXml: false, isJson: true, isMarkdown: false, needsContentPeek: true };
  }
  return { isXml: false, isJson: false, isMarkdown: false, needsContentPeek: true };
}

/** Infer flags from a small head sample (a few KB is enough). */
export function flagsFromContentHead(
  filePath: string,
  head: string,
  detectIsJsonLog: (sample: string) => boolean
): FileTypeFlags {
  const fromExt = flagsFromExtension(filePath);
  if (!fromExt.needsContentPeek) {
    return { isXml: fromExt.isXml, isJson: fromExt.isJson, isMarkdown: fromExt.isMarkdown };
  }

  const trimmed = head.trimStart();
  let isXml = fromExt.isXml;
  let isJson = fromExt.isJson;

  if (!isXml && (trimmed.startsWith('<?xml') || /^<[A-Za-z][A-Za-z0-9\-_]*[\s>]/.test(trimmed))) {
    isXml = true;
    isJson = false;
  } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    isJson = !detectIsJsonLog(head);
  } else if (fromExt.isJson) {
    // Extension says .json but content doesn't look like JSON object/array
    isJson = false;
  }

  return { isXml, isJson, isMarkdown: false };
}

/** Put the preferred (active) tab snapshot first so restore can prioritize it. */
export function prioritizeOpenTabSnapshots<T extends { filePaths: string[] }>(
  snapshots: T[],
  preferredActiveKey: string | undefined,
  keyOf: (paths: string[]) => string
): T[] {
  if (!preferredActiveKey || snapshots.length <= 1) return snapshots;
  const idx = snapshots.findIndex((s) => keyOf(s.filePaths) === preferredActiveKey);
  if (idx <= 0) return snapshots;
  const copy = [...snapshots];
  const [active] = copy.splice(idx, 1);
  return [active, ...copy];
}
