import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathGuardError';
  }
}

function normalizeForCompare(p: string): string {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

export function resolveReadablePath(filePath: string, root?: string): string {
  if (!filePath?.trim()) {
    throw new PathGuardError('filePath is required');
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new PathGuardError(`File not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new PathGuardError(`Not a file: ${resolved}`);
  }

  const effectiveRoot = root?.trim() || process.env.LOGSTUDIO_MCP_ROOT?.trim();
  if (effectiveRoot) {
    const rootResolved = path.resolve(effectiveRoot);
    const rel = path.relative(rootResolved, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new PathGuardError(
        `Path is outside allowed root (${rootResolved}). Set LOGSTUDIO_MCP_ROOT to widen access.`
      );
    }
  }

  return resolved;
}

export function readFileLimited(filePath: string, maxBytes = DEFAULT_MAX_BYTES): string {
  const stat = fs.statSync(filePath);
  if (stat.size > maxBytes) {
    throw new PathGuardError(
      `File is ${stat.size} bytes (limit ${maxBytes}). Use get_log_excerpt or search_log instead of read_log_file.`
    );
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function getFileInfo(filePath: string) {
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    basename: path.basename(filePath),
    dirname: path.dirname(filePath),
    rootHint: process.env.LOGSTUDIO_MCP_ROOT || null,
    comparableRoot: process.env.LOGSTUDIO_MCP_ROOT
      ? normalizeForCompare(process.env.LOGSTUDIO_MCP_ROOT)
      : null,
  };
}
