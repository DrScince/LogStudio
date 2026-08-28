import { describe, it, expect } from 'vitest';
import {
  buildLogFileExcerpt,
  listErrors,
  listFatalErrors,
  searchLog,
  readLineRange,
} from './logUtils.js';

describe('buildLogFileExcerpt', () => {
  it('keeps short files intact', () => {
    const content = 'INFO start\nERROR boom host=db\nINFO done';
    const r = buildLogFileExcerpt(content, 1000);
    expect(r.truncated).toBe(false);
    expect(r.excerpt).toBe(content);
    expect(r.totalLines).toBe(3);
  });

  it('prefers error lines when truncating a large file', () => {
    const noise = Array.from({ length: 400 }, (_, i) => `2026-01-01 INFO line ${i} filler ${'x'.repeat(80)}`);
    noise.splice(50, 0, '2026-01-01 ERROR DatabaseConnectionFailed host=db.internal code=ECONNREFUSED');
    noise.push('2026-01-01 FATAL Worker crashed at UserService.getById');
    const content = noise.join('\n');
    const r = buildLogFileExcerpt(content, 4000);
    expect(r.truncated).toBe(true);
    expect(r.excerpt).toMatch(/ECONNREFUSED/);
    expect(r.excerpt).toMatch(/UserService\.getById/);
  });
});

describe('listErrors', () => {
  it('finds error and warn lines', () => {
    const content = 'INFO ok\nWARN slow query\nERROR disk full\nINFO done';
    const matches = listErrors(content);
    expect(matches.map((m) => m.lineNumber)).toEqual([2, 3]);
  });
});

describe('listFatalErrors', () => {
  it('finds only fatal lines', () => {
    const content = 'ERROR soft\nFATAL crash\nCRITICAL stop\nWARN maybe';
    const matches = listFatalErrors(content);
    expect(matches.map((m) => m.text)).toEqual([
      'FATAL crash',
      'CRITICAL stop',
    ]);
  });
});

describe('searchLog', () => {
  it('searches case-insensitively by default', () => {
    const content = 'Hello World\nfoo bar';
    const matches = searchLog(content, 'hello');
    expect(matches).toHaveLength(1);
    expect(matches[0].lineNumber).toBe(1);
  });

  it('supports regex mode', () => {
    const content = 'user=alice\nuser=bob\nadmin=root';
    const matches = searchLog(content, '^user=', { regex: true });
    expect(matches).toHaveLength(2);
  });
});

describe('readLineRange', () => {
  it('returns inclusive line range', () => {
    const content = 'a\nb\nc\nd';
    const { lines, totalLines } = readLineRange(content, 2, 3);
    expect(totalLines).toBe(4);
    expect(lines.map((l) => l.text)).toEqual(['b', 'c']);
  });
});
