import { describe, it, expect } from 'vitest';
import {
  parseEnumOptionsFromComment,
  getTrailingCommentOptions,
  isHiddenOptionsComment,
} from './xmlCommentOptions';

describe('parseEnumOptionsFromComment', () => {
  it('returns null without semicolon', () => {
    expect(parseEnumOptionsFromComment('just a note')).toBeNull();
  });

  it('parses semicolon-separated values and dedupes', () => {
    expect(
      parseEnumOptionsFromComment(
        'FeatureDevelopmentPlugin;RegressionTestPlugin;FeatureDevelopmentPlugin'
      )
    ).toEqual(['FeatureDevelopmentPlugin', 'RegressionTestPlugin']);
  });

  it('trims whitespace around values', () => {
    expect(parseEnumOptionsFromComment(' a ; b ; c ')).toEqual(['a', 'b', 'c']);
  });
});

describe('getTrailingCommentOptions / isHiddenOptionsComment', () => {
  it('reads options from the next comment sibling', () => {
    const doc = new DOMParser().parseFromString(
      '<Root><DefaultPlugin>X</DefaultPlugin><!-- A;B;C --></Root>',
      'application/xml'
    );
    const el = doc.querySelector('DefaultPlugin')!;
    expect(getTrailingCommentOptions(el)).toEqual(['A', 'B', 'C']);
    const comment = el.nextSibling!;
    expect(isHiddenOptionsComment(comment)).toBe(true);
  });

  it('ignores normal comments without semicolon', () => {
    const doc = new DOMParser().parseFromString(
      '<Root><DefaultPlugin>X</DefaultPlugin><!-- note --></Root>',
      'application/xml'
    );
    const el = doc.querySelector('DefaultPlugin')!;
    expect(getTrailingCommentOptions(el)).toBeNull();
    expect(isHiddenOptionsComment(el.nextSibling!)).toBe(false);
  });
});
