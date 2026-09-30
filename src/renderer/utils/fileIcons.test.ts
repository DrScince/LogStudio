import { describe, expect, it } from 'vitest';
import { getFileExtension, getFileIconInfo } from './fileIcons';

describe('getFileExtension', () => {
  it('returns the last extension', () => {
    expect(getFileExtension('foo.dll')).toBe('dll');
    expect(getFileExtension('Foo.XML')).toBe('xml');
  });

  it('maps compound suffixes to the primary type', () => {
    expect(getFileExtension('SapDmPlugin.deps.json')).toBe('json');
    expect(getFileExtension('app.runtimeconfig.json')).toBe('json');
    expect(getFileExtension('bundle.min.js')).toBe('js');
  });

  it('returns empty string without extension', () => {
    expect(getFileExtension('Dockerfile')).toBe('');
    expect(getFileExtension('.gitignore')).toBe('');
  });
});

describe('getFileIconInfo', () => {
  it('uses distinct color classes for common .NET / log types', () => {
    expect(getFileIconInfo('iACF.DataChannel.Shared.dll').colorClass).toBe('dll');
    expect(getFileIconInfo('iACF.DataChannel.Shared.pdb').colorClass).toBe('pdb');
    expect(getFileIconInfo('iACF.DataChannel.Shared.xml').colorClass).toBe('xml');
    expect(getFileIconInfo('SapDmPlugin.deps.json').colorClass).toBe('json');
    expect(getFileIconInfo('nlog.config').colorClass).toBe('config');
    expect(getFileIconInfo('app.log').colorClass).toBe('log');
  });

  it('falls back for unknown extensions', () => {
    expect(getFileIconInfo('mystery.xyz').colorClass).toBe('default');
  });
});
