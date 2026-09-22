import { describe, expect, it } from 'vitest';
import { detectLogFormat, parseWithFormat } from './logFormatDetector';

const COPILOT_SAMPLE = `[2026-03-18T14:22:01.142Z] [INFO] [GitHub.Copilot] Copilot language server starting
[2026-03-18T14:24:48.201Z] [ERROR] [GitHub.Copilot] EdgeProcess exited immediately after start (exitCode=0)
[2026-03-18T14:26:02.111Z] [WARN] [GitHub.Copilot] Network retry attempt=1/3 status=429
`;

describe('bracket-iso / Copilot logs', () => {
  it('detects bracketed ISO Copilot logs', () => {
    const fmt = detectLogFormat(COPILOT_SAMPLE);
    expect(fmt.name).toBe('bracket-iso');
    expect(fmt.confidence).toBeGreaterThan(0.8);
  });

  it('parses level, namespace and message', () => {
    const fmt = detectLogFormat(COPILOT_SAMPLE);
    const entries = parseWithFormat(COPILOT_SAMPLE, fmt);
    expect(entries).toHaveLength(3);
    expect(entries[0].level).toBe('INFO');
    expect(entries[0].namespace).toBe('GitHub.Copilot');
    expect(entries[0].message).toContain('language server starting');
    expect(entries[1].level).toBe('ERROR');
    expect(entries[2].level).toBe('WARN');
  });
});

describe('plain-text fallback', () => {
  it('falls back to one entry per line when no format matches', () => {
    const content = 'just some freeform text\nanother line without timestamp\n';
    const fmt = detectLogFormat(content);
    const entries = parseWithFormat(content, fmt);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0].message).toContain('freeform');
  });
});
