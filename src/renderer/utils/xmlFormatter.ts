/**
 * Pretty-prints an XML string with consistent 4-space indentation.
 * Leaf elements (<Tag>value</Tag>) stay on a single line.
 */
export function formatXml(xml: string, indent = '    '): string {
  // Preserve XML declaration
  const declMatch = xml.match(/^<\?xml[^?]*\?>/i);
  const decl = declMatch ? declMatch[0] + '\n' : '';
  const body = declMatch ? xml.slice(declMatch[0].length).trimStart() : xml;

  // Tokenise: tags, comments, CDATA, and text
  const tokens: string[] = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === '<') {
      if (body.startsWith('<!--', i)) {
        const end = body.indexOf('-->', i);
        if (end === -1) { tokens.push(body.slice(i)); break; }
        tokens.push(body.slice(i, end + 3));
        i = end + 3;
      } else if (body.startsWith('<![CDATA[', i)) {
        const end = body.indexOf(']]>', i);
        if (end === -1) { tokens.push(body.slice(i)); break; }
        tokens.push(body.slice(i, end + 3));
        i = end + 3;
      } else {
        const end = body.indexOf('>', i);
        if (end === -1) { tokens.push(body.slice(i)); break; }
        tokens.push(body.slice(i, end + 1));
        i = end + 1;
      }
    } else {
      const next = body.indexOf('<', i);
      const text = next === -1 ? body.slice(i) : body.slice(i, next);
      if (text.trim()) tokens.push(text.trim());
      i = next === -1 ? body.length : next;
    }
  }

  let depth = 0;
  const lines: string[] = [];

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];

    if (tok.startsWith('</')) {
      // Closing tag
      depth = Math.max(0, depth - 1);
      lines.push(indent.repeat(depth) + tok);
    } else if (tok.startsWith('<!--')) {
      // Comment
      lines.push(indent.repeat(depth) + tok);
    } else if (tok.startsWith('<') && tok.endsWith('/>')) {
      // Self-closing
      lines.push(indent.repeat(depth) + tok);
    } else if (tok.startsWith('<?')) {
      // Processing instruction
      lines.push(indent.repeat(depth) + tok);
    } else if (tok.startsWith('<')) {
      // Opening tag — look ahead: if next is text then closing tag → leaf
      const next1 = tokens[t + 1];
      const next2 = tokens[t + 2];
      if (
        next1 !== undefined &&
        !next1.startsWith('<') &&
        next2 !== undefined &&
        next2.startsWith('</')
      ) {
        lines.push(indent.repeat(depth) + tok + next1 + next2);
        t += 2;
      } else {
        lines.push(indent.repeat(depth) + tok);
        depth++;
      }
    } else {
      // Bare text node (mixed content fallback)
      lines.push(indent.repeat(depth) + tok);
    }
  }

  return decl + lines.join('\n');
}
