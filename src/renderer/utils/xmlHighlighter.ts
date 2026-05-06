/** Escape HTML special characters */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Highlight the attribute portion of a tag body (everything after the tag name) */
function highlightAttrs(attrStr: string): string {
  // Match name="value" or name='value'
  return attrStr.replace(
    /([\w:.-]+)(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    (_, name, eq, val) =>
      `<span class="xh-attr-name">${esc(name)}</span>` +
      `<span class="xh-op">${eq}</span>` +
      `<span class="xh-attr-val">${esc(val)}</span>`
  );
}

/** Render a tag token (content between < and >, exclusive) as highlighted HTML */
function renderTag(inner: string): string {
  const lt = '<span class="xh-bracket">&lt;</span>';
  const gt = '<span class="xh-bracket">&gt;</span>';
  const sl = '<span class="xh-bracket">/</span>';

  const isClosing = inner.startsWith('/');
  const body = isClosing ? inner.slice(1) : inner;
  const isSelfClosing = body.trimEnd().endsWith('/');
  const bodyNoSlash = isSelfClosing ? body.slice(0, body.lastIndexOf('/')).trimEnd() : body;

  // Extract tag name
  const nameMatch = bodyNoSlash.match(/^([\w:.-]+)/);
  if (!nameMatch) return `${lt}${esc(inner)}${gt}`;

  const tagName = nameMatch[1];
  const rest = bodyNoSlash.slice(tagName.length);
  const tn = `<span class="xh-tag-name">${esc(tagName)}</span>`;
  const attrHtml = rest ? highlightAttrs(esc(rest).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')) : '';

  if (isClosing) return `${lt}${sl}${tn}${gt}`;
  if (isSelfClosing) return `${lt}${tn}${attrHtml}${sl}${gt}`;
  return `${lt}${tn}${attrHtml}${gt}`;
}

/**
 * Tokenise an XML string and return an HTML string with syntax-highlight spans.
 * Safe to use with dangerouslySetInnerHTML.
 */
export function highlightXml(text: string): string {
  let html = '';
  let i = 0;

  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      // Comment
      const end = text.indexOf('-->', i);
      const len = end === -1 ? text.length : end + 3;
      html += `<span class="xh-comment">${esc(text.slice(i, len))}</span>`;
      i = len;
    } else if (text.startsWith('<![CDATA[', i)) {
      // CDATA section
      const end = text.indexOf(']]>', i);
      const len = end === -1 ? text.length : end + 3;
      html += `<span class="xh-cdata">${esc(text.slice(i, len))}</span>`;
      i = len;
    } else if (text.startsWith('<?', i)) {
      // Processing instruction (includes <?xml ...?>)
      const end = text.indexOf('?>', i);
      const len = end === -1 ? text.length : end + 2;
      html += `<span class="xh-pi">${esc(text.slice(i, len))}</span>`;
      i = len;
    } else if (text.startsWith('<!', i)) {
      // DOCTYPE or similar
      const end = text.indexOf('>', i);
      const len = end === -1 ? text.length : end + 1;
      html += `<span class="xh-doctype">${esc(text.slice(i, len))}</span>`;
      i = len;
    } else if (text[i] === '<') {
      // Regular tag
      const end = text.indexOf('>', i);
      if (end === -1) {
        html += `<span class="xh-bracket">&lt;</span>${esc(text.slice(i + 1))}`;
        i = text.length;
      } else {
        html += renderTag(text.slice(i + 1, end));
        i = end + 1;
      }
    } else {
      // Text content – find next <
      const next = text.indexOf('<', i);
      const content = next === -1 ? text.slice(i) : text.slice(i, next);
      html += `<span class="xh-text">${esc(content)}</span>`;
      i = next === -1 ? text.length : next;
    }
  }

  return html;
}
