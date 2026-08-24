import { describe, it, expect } from 'vitest';
import { buildLogFileExcerpt } from './aiLogContext';

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
