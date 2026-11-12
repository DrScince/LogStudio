import { describe, it, expect } from 'vitest';
import { getFileArgument } from './cliArgs';

describe('getFileArgument', () => {
  it('reads the file path from packaged argv', () => {
    expect(
      getFileArgument(['C:/App/LogStudio.exe', 'D:/logs/app.log'], {
        isPackaged: true,
      })
    ).toBe('D:/logs/app.log');
  });

  it('skips electron and "." in development argv', () => {
    expect(
      getFileArgument(['electron', '.', '/tmp/out.log', '--dev'], { isPackaged: false })
    ).toBe('/tmp/out.log');
  });

  it('matches extensions case-insensitively', () => {
    expect(
      getFileArgument(['LogStudio.exe', 'C:/Logs/APP.LOG'], { isPackaged: true })
    ).toBe('C:/Logs/APP.LOG');
  });

  it('ignores flag-like arguments', () => {
    expect(
      getFileArgument(['LogStudio.exe', '--dev', '/tmp/a.log'], { isPackaged: true })
    ).toBe('/tmp/a.log');
  });

  it('falls back to an existing file without a known extension', () => {
    expect(
      getFileArgument(['LogStudio.exe', '/tmp/notes.out'], {
        isPackaged: true,
        isExistingFile: (p) => p === '/tmp/notes.out',
      })
    ).toBe('/tmp/notes.out');
  });

  it('returns null when no file argument is present', () => {
    expect(getFileArgument(['LogStudio.exe'], { isPackaged: true })).toBeNull();
  });
});
