import { describe, it, expect } from 'vitest';
import { escapeRtf, plainTextToRtf, jsonToRtf, xmlToRtf } from './rtfClipboard';

describe('rtfClipboard', () => {
  it('escapes RTF special characters', () => {
    expect(escapeRtf('a\\b{c}d')).toBe('a\\\\b\\{c\\}d');
  });

  it('wraps plain text as RTF document', () => {
    const rtf = plainTextToRtf('hello\nworld');
    expect(rtf.startsWith('{\\rtf1')).toBe(true);
    expect(rtf).toContain('hello\\par\nworld');
    expect(rtf.endsWith('}')).toBe(true);
  });

  it('colors JSON keys and strings', () => {
    const rtf = jsonToRtf('{"a":1}');
    expect(rtf).toContain('\\cf');
    expect(rtf).toContain('a');
  });

  it('colors XML tags', () => {
    const rtf = xmlToRtf('<Root attr="x"/>');
    expect(rtf).toContain('Root');
    expect(rtf).toContain('\\cf');
  });
});
