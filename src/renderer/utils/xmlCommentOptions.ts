/** Parse `a;b;c` style option lists from XML trailing comments. */

export function parseEnumOptionsFromComment(text: string): string[] | null {
  const raw = text.trim();
  if (!raw.includes(';')) return null;

  const seen = new Set<string>();
  const options: string[] = [];
  for (const part of raw.split(';')) {
    const value = part.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push(value);
  }
  return options.length > 0 ? options : null;
}

function skipWhitespaceText(node: ChildNode | null): ChildNode | null {
  let current = node;
  while (
    current &&
    current.nodeType === Node.TEXT_NODE &&
    !(current.textContent || '').trim()
  ) {
    current = current.nextSibling;
  }
  return current;
}

function skipWhitespaceTextPrev(node: ChildNode | null): ChildNode | null {
  let current = node;
  while (
    current &&
    current.nodeType === Node.TEXT_NODE &&
    !(current.textContent || '').trim()
  ) {
    current = current.previousSibling;
  }
  return current;
}

/** Options from a `<!-- a;b;c -->` comment immediately after the element. */
export function getTrailingCommentOptions(el: Element): string[] | null {
  const sib = skipWhitespaceText(el.nextSibling);
  if (!sib || sib.nodeType !== Node.COMMENT_NODE) return null;
  return parseEnumOptionsFromComment(sib.textContent || '');
}

/**
 * True when this comment is option-metadata for the previous element sibling
 * and should not be shown as its own tree row.
 */
export function isHiddenOptionsComment(node: Node): boolean {
  if (node.nodeType !== Node.COMMENT_NODE) return false;
  if (!parseEnumOptionsFromComment(node.textContent || '')) return false;
  const prev = skipWhitespaceTextPrev(node.previousSibling);
  return !!prev && prev.nodeType === Node.ELEMENT_NODE;
}
