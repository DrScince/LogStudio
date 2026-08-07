/** Build plain + RTF clipboard payloads (Windows CF_RTF via Electron). */

export function escapeRtf(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\') {
      out += '\\\\';
    } else if (ch === '{') {
      out += '\\{';
    } else if (ch === '}') {
      out += '\\}';
    } else if (ch === '\n') {
      out += '\\par\n';
    } else if (ch === '\r') {
      /* skip; handled with \n */
    } else if (code < 0x80) {
      out += ch;
    } else if (code <= 0xffff) {
      const signed = code > 32767 ? code - 65536 : code;
      out += `\\u${signed}?`;
    } else {
      const cp = code - 0x10000;
      const high = 0xd800 + (cp >> 10);
      const low = 0xdc00 + (cp & 0x3ff);
      const hs = high > 32767 ? high - 65536 : high;
      const ls = low > 32767 ? low - 65536 : low;
      out += `\\u${hs}?\\u${ls}?`;
    }
  }
  return out;
}

/** Color table indices (1-based; 0 = default). */
export const RtfColor = {
  default: 1,
  muted: 2,
  accent: 3,
  string: 4,
  number: 5,
  keyword: 6,
  error: 7,
  warn: 8,
  info: 9,
  success: 10,
  tag: 11,
  attr: 12,
} as const;

const COLOR_TBL =
  '{\\colortbl;' +
  '\\red230\\green237\\blue243;' + // 1 default
  '\\red139\\green148\\blue158;' + // 2 muted
  '\\red88\\green166\\blue255;' + // 3 accent
  '\\red165\\green214\\blue255;' + // 4 string
  '\\red121\\green192\\blue255;' + // 5 number
  '\\red255\\green123\\blue114;' + // 6 keyword
  '\\red248\\green81\\blue73;' + // 7 error
  '\\red210\\green153\\blue34;' + // 8 warn
  '\\red88\\green166\\blue255;' + // 9 info
  '\\red63\\green185\\blue80;' + // 10 success
  '\\red126\\green231\\blue135;' + // 11 tag
  '\\red255\\green166\\blue87;' + // 12 attr
  '}';

export function wrapRtfDocument(body: string): string {
  return (
    '{\\rtf1\\ansi\\deff0\\uc1\n' +
    '{\\fonttbl{\\f0 Consolas;}{\\f1 Segoe UI;}}\n' +
    COLOR_TBL +
    '\n\\f0\\fs18\\cf1\n' +
    body +
    '\n}'
  );
}

export function rtfColored(text: string, colorIndex: number): string {
  return `\\cf${colorIndex} ${escapeRtf(text)}\\cf1 `;
}

export function plainTextToRtf(text: string): string {
  return wrapRtfDocument(escapeRtf(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')));
}

/** Lightweight JSON syntax coloring for RTF (document body only). */
export function jsonToRtfBody(text: string): string {
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;
  let body = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      let escaped = false;
      while (j < src.length) {
        if (escaped) {
          escaped = false;
          j++;
          continue;
        }
        if (src[j] === '\\') {
          escaped = true;
          j++;
          continue;
        }
        if (src[j] === '"') break;
        j++;
      }
      const str = src.slice(i, Math.min(j + 1, src.length));
      i = Math.min(j + 1, src.length);
      let k = i;
      while (k < src.length && /\s/.test(src[k])) k++;
      const isKey = src[k] === ':';
      body += rtfColored(str, isKey ? RtfColor.attr : RtfColor.string);
      continue;
    }
    if (/[-0-9]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[0-9.eE+-]/.test(src[j])) j++;
      body += rtfColored(src.slice(i, j), RtfColor.number);
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'true' || word === 'false' || word === 'null') {
        body += rtfColored(word, RtfColor.keyword);
      } else {
        body += escapeRtf(word);
      }
      i = j;
      continue;
    }
    if (ch === '\n') {
      body += '\\par\n';
      i++;
      continue;
    }
    body += escapeRtf(ch);
    i++;
  }
  return body;
}

export function jsonToRtf(text: string): string {
  return wrapRtfDocument(jsonToRtfBody(text));
}

/** Lightweight XML syntax coloring for RTF (document body only). */
export function xmlToRtfBody(text: string): string {
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;
  let body = '';
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const chunk = end === -1 ? src.slice(i) : src.slice(i, end + 3);
      body += rtfColored(chunk, RtfColor.muted);
      i += chunk.length;
      continue;
    }
    if (src[i] === '<') {
      const end = src.indexOf('>', i);
      if (end === -1) {
        body += escapeRtf(src.slice(i));
        break;
      }
      const tag = src.slice(i, end + 1);
      body += colorXmlTag(tag);
      i = end + 1;
      continue;
    }
    if (src[i] === '\n') {
      body += '\\par\n';
      i++;
      continue;
    }
    let j = i + 1;
    while (j < src.length && src[j] !== '<' && src[j] !== '\n') j++;
    body += escapeRtf(src.slice(i, j));
    i = j;
  }
  return body;
}

export function xmlToRtf(text: string): string {
  return wrapRtfDocument(xmlToRtfBody(text));
}

function colorXmlTag(tag: string): string {
  // <?xml ...?>, </tag>, <tag attr="v">
  const m = tag.match(/^<\/?([A-Za-z_][\w:.-]*)([^>]*)\/?>$/);
  if (!m) return rtfColored(tag, RtfColor.tag);
  const [, name, rest] = m;
  const isClose = tag.startsWith('</');
  const isPi = tag.startsWith('<?');
  if (isPi) return rtfColored(tag, RtfColor.muted);
  let out = rtfColored(isClose ? `</${name}` : `<${name}`, RtfColor.tag);
  const attrRe = /([A-Za-z_][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')/g;
  let last = 0;
  let am: RegExpExecArray | null;
  while ((am = attrRe.exec(rest))) {
    if (am.index > last) out += escapeRtf(rest.slice(last, am.index));
    out += rtfColored(am[1], RtfColor.attr);
    out += escapeRtf(am[2]);
    out += rtfColored(am[3], RtfColor.string);
    last = am.index + am[0].length;
  }
  if (last < rest.length) out += escapeRtf(rest.slice(last));
  out += rtfColored(tag.endsWith('/>') ? '/>' : '>', RtfColor.tag);
  return out;
}

export function levelToRtfColor(level: string): number {
  const l = level.toUpperCase();
  if (l.includes('ERR') || l.includes('FATAL') || l.includes('CRIT')) return RtfColor.error;
  if (l.includes('WARN')) return RtfColor.warn;
  if (l.includes('INFO')) return RtfColor.info;
  if (l.includes('DEBUG') || l.includes('TRACE')) return RtfColor.muted;
  if (l.includes('OK') || l.includes('SUCC')) return RtfColor.success;
  return RtfColor.default;
}

export interface LogEntryLike {
  timestamp?: string;
  level?: string;
  namespace?: string;
  message?: string;
  fullText?: string;
}

export function detectPayloadKind(text: string): 'json' | 'xml' | 'text' {
  const trimmed = text.trim();
  if (!trimmed) return 'text';
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* fall through */
    }
  }
  if (trimmed.startsWith('<') && trimmed.includes('>')) return 'xml';
  return 'text';
}

export function formatPayloadPlain(text: string): { plain: string; kind: 'json' | 'xml' | 'text' } {
  const kind = detectPayloadKind(text);
  if (kind === 'json') {
    try {
      return { plain: JSON.stringify(JSON.parse(text.trim()), null, 2), kind };
    } catch {
      return { plain: text, kind: 'text' };
    }
  }
  return { plain: text, kind };
}

export function payloadToRtf(text: string): { plain: string; rtf: string } {
  const { plain, kind } = formatPayloadPlain(text);
  if (kind === 'json') return { plain, rtf: jsonToRtf(plain) };
  if (kind === 'xml') return { plain, rtf: xmlToRtf(plain) };
  return { plain, rtf: plainTextToRtf(plain) };
}

export function payloadToRtfBody(text: string): { plain: string; body: string } {
  const { plain, kind } = formatPayloadPlain(text);
  if (kind === 'json') return { plain, body: jsonToRtfBody(plain) };
  if (kind === 'xml') return { plain, body: xmlToRtfBody(plain) };
  return { plain, body: escapeRtf(plain.replace(/\r\n/g, '\n').replace(/\r/g, '\n')) };
}

export function logEntryToPlainAndRtf(
  entry: LogEntryLike,
  options?: { includePayload?: boolean }
): { plain: string; rtf: string } {
  const header = [entry.timestamp, entry.level, entry.namespace, entry.message]
    .filter(Boolean)
    .join(' | ');
  const includePayload = options?.includePayload !== false;
  const full = (entry.fullText ?? '').trim();
  const message = (entry.message ?? '').trim();

  let body = '';
  body += rtfColored(entry.timestamp ? `${entry.timestamp} ` : '', RtfColor.muted);
  body += rtfColored(entry.level ? `${entry.level} ` : '', levelToRtfColor(entry.level || ''));
  body += rtfColored(entry.namespace ? `${entry.namespace} ` : '', RtfColor.accent);
  body += escapeRtf(entry.message || '');

  let plain = header;
  if (includePayload && full && full !== message) {
    const { plain: payloadPlain, body: payloadBody } = payloadToRtfBody(full);
    plain += `\n\n${payloadPlain}`;
    body += '\\par\n\\par\n' + payloadBody;
  }

  return { plain, rtf: wrapRtfDocument(body) };
}

export function logEntriesToPlainAndRtf(entries: LogEntryLike[]): { plain: string; rtf: string } {
  const plains: string[] = [];
  const bodies: string[] = [];
  for (const entry of entries) {
    const { plain, rtf } = logEntryToPlainAndRtf(entry);
    plains.push(plain);
    const inner = rtf.replace(/^[\s\S]*\\fs18\\cf1\n/, '').replace(/\n\}$/, '');
    bodies.push(inner);
  }
  return {
    plain: plains.join('\n\n'),
    rtf: wrapRtfDocument(bodies.join('\\par\n\\par\n')),
  };
}

export async function copyPlainAndRtf(plain: string, rtf: string): Promise<void> {
  if (window.electronAPI?.writeClipboard) {
    const result = await window.electronAPI.writeClipboard({ text: plain, rtf });
    if (!result.success) throw new Error(result.error || 'Clipboard write failed');
    return;
  }
  await navigator.clipboard.writeText(plain);
}
