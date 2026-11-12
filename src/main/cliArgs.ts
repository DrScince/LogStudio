import * as fs from 'fs';

const KNOWN_OPEN_EXTENSIONS =
  /\.(log|txt|xml|json|config|conf|ini|md|markdown|csv|yml|yaml)$/i;

export type FileArgOptions = {
  isPackaged: boolean;
  /** Injectable for tests; defaults to fs.existsSync + isFile. */
  isExistingFile?: (filePath: string) => boolean;
};

const defaultIsExistingFile = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

/**
 * Resolve a file path from process argv when the OS / shell opens a file
 * with LogStudio (file association, "Open with", second-instance).
 */
export function getFileArgument(
  argv: string[],
  options: FileArgOptions = { isPackaged: true }
): string | null {
  // Packaged: [exe, file? , ...flags]
  // Dev: [electron, ., file?, ...flags]
  const args = options.isPackaged ? argv.slice(1) : argv.slice(2);
  const isExistingFile = options.isExistingFile ?? defaultIsExistingFile;

  const candidates = args.filter((arg) => {
    if (!arg || arg === '.') return false;
    if (arg.startsWith('-')) return false;
    // Skip the Electron/app binary itself when it appears as an argument.
    const lower = arg.toLowerCase();
    if (lower.endsWith('.exe') && lower.includes('logstudio')) return false;
    if (lower.endsWith('electron.exe') || lower.endsWith('/electron') || lower.endsWith('\\electron')) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  const known = candidates.find((arg) => KNOWN_OPEN_EXTENSIONS.test(arg));
  if (known) return known;

  for (const arg of candidates) {
    if (isExistingFile(arg)) return arg;
  }

  return null;
}
