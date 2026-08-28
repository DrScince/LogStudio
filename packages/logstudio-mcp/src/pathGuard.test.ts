import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveReadablePath, readFileLimited } from './pathGuard.js';

describe('pathGuard', () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logstudio-mcp-'));
    logFile = path.join(tmpDir, 'app.log');
    fs.writeFileSync(logFile, 'INFO start\nERROR boom\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.LOGSTUDIO_MCP_ROOT;
  });

  it('resolves existing files', () => {
    expect(resolveReadablePath(logFile)).toBe(path.resolve(logFile));
  });

  it('rejects missing files', () => {
    expect(() => resolveReadablePath(path.join(tmpDir, 'missing.log'))).toThrow(/not found/i);
  });

  it('restricts paths outside LOGSTUDIO_MCP_ROOT', () => {
    process.env.LOGSTUDIO_MCP_ROOT = tmpDir;
    expect(() => resolveReadablePath('/etc/passwd')).toThrow(/outside allowed root/i);
    expect(resolveReadablePath(logFile)).toBe(path.resolve(logFile));
  });

  it('reads small files', () => {
    const content = readFileLimited(logFile);
    expect(content).toContain('ERROR boom');
  });
});
