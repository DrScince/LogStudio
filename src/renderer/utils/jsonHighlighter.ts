/** Escape HTML special characters */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Tokenise a JSON string and return an HTML string with syntax-highlight spans.
 * Safe to use with dangerouslySetInnerHTML.
 */
export function highlightJson(text: string): string {
  let html = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (ch === '"') {
      // String token — scan to closing quote, handling escape sequences
      let j = i + 1;
      while (j < len) {
        if (text[j] === '\\') { j += 2; }
        else if (text[j] === '"') { j++; break; }
        else { j++; }
      }
      const raw = text.slice(i, j);
      // Peek ahead past whitespace to detect if this is a key (followed by ':')
      let k = j;
      while (k < len && (text[k] === ' ' || text[k] === '\t')) k++;
      if (text[k] === ':') {
        html += `<span class="jh-key">${esc(raw)}</span>`;
      } else {
        html += `<span class="jh-string">${esc(raw)}</span>`;
      }
      i = j;

    } else if (ch === 't' && text.startsWith('true', i)) {
      html += `<span class="jh-bool">true</span>`;
      i += 4;

    } else if (ch === 'f' && text.startsWith('false', i)) {
      html += `<span class="jh-bool">false</span>`;
      i += 5;

    } else if (ch === 'n' && text.startsWith('null', i)) {
      html += `<span class="jh-null">null</span>`;
      i += 4;

    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const m = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (m) {
        html += `<span class="jh-number">${esc(m[0])}</span>`;
        i += m[0].length;
      } else {
        html += esc(ch);
        i++;
      }

    } else if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      html += `<span class="jh-bracket">${esc(ch)}</span>`;
      i++;

    } else if (ch === ':') {
      html += `<span class="jh-colon">:</span>`;
      i++;

    } else if (ch === ',') {
      html += `<span class="jh-comma">,</span>`;
      i++;

    } else {
      html += esc(ch);
      i++;
    }
  }

  return html;
}
