import { describe, expect, it } from 'vitest';
import { detectLogFormat, parseWithFormat } from './logFormatDetector';

const COPILOT_SAMPLE = `[2026-03-18T14:22:01.142Z] [INFO] [GitHub.Copilot] Copilot language server starting
[2026-03-18T14:24:48.201Z] [ERROR] [GitHub.Copilot] EdgeProcess exited immediately after start (exitCode=0)
[2026-03-18T14:26:02.111Z] [WARN] [GitHub.Copilot] Network retry attempt=1/3 status=429
`;

const COPILOT_LOWERCASE = `[2026-03-18T14:22:01.142Z] [info] [GitHub.Copilot] agent ready
[2026-03-18T14:22:02.000Z] [warning] [CopilotChat] slow response
`;

const VS_OUTPUT_NO_LOGGER = `[2026-03-18T14:22:01.142Z] [INFO] plain message without logger bracket
[2026-03-18T14:22:02.000Z] [ERROR] another plain message
`;

describe('vs-copilot / GitHub Copilot logs', () => {
  it('detects branded Copilot logs as vs-copilot (not plain-text)', () => {
    const fmt = detectLogFormat(COPILOT_SAMPLE);
    expect(fmt.name).toBe('vs-copilot');
    expect(fmt.displayName).toMatch(/Copilot/);
    expect(fmt.confidence).toBeGreaterThan(0.8);
  });

  it('parses level, namespace and message structurally', () => {
    const fmt = detectLogFormat(COPILOT_SAMPLE);
    const entries = parseWithFormat(COPILOT_SAMPLE, fmt);
    expect(entries).toHaveLength(3);
    expect(entries[0].level).toBe('INFO');
    expect(entries[0].namespace).toBe('GitHub.Copilot');
    expect(entries[0].message).toContain('language server starting');
    expect(entries[1].level).toBe('ERROR');
    expect(entries[2].level).toBe('WARN');
  });

  it('accepts lowercase levels common in VS Code output', () => {
    const fmt = detectLogFormat(COPILOT_LOWERCASE);
    expect(fmt.name).toBe('vs-copilot');
    const entries = parseWithFormat(COPILOT_LOWERCASE, fmt);
    expect(entries[0].level).toBe('INFO');
    expect(entries[1].level).toBe('WARN');
    expect(entries[1].namespace).toBe('CopilotChat');
  });

  it('detects bracketed VS output even without Copilot branding', () => {
    const fmt = detectLogFormat(VS_OUTPUT_NO_LOGGER);
    expect(fmt.name).toBe('vs-copilot');
    const entries = parseWithFormat(VS_OUTPUT_NO_LOGGER, fmt);
    expect(entries).toHaveLength(2);
    expect(entries[0].namespace).toBe('');
    expect(entries[0].message).toContain('without logger');
  });

  it('can be disabled via enabledFormats', () => {
    const fmt = detectLogFormat(COPILOT_SAMPLE, ['pipe', 'log4j']);
    expect(fmt.name).not.toBe('vs-copilot');
  });
});

describe('plain-text fallback (last resort only)', () => {
  it('marks unmatched freeform content as plain-text', () => {
    const content = 'just some freeform text\nanother line without timestamp\n';
    const fmt = detectLogFormat(content);
    expect(fmt.name).toBe('plain-text');
  });

  it('still yields one entry per line when parsing plain-text', () => {
    const content = 'just some freeform text\nanother line without timestamp\n';
    const fmt = detectLogFormat(content);
    const entries = parseWithFormat(content, fmt);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0].message).toContain('freeform');
  });
});
