import { describe, it, expect } from 'vitest';
import {
  flagsFromExtension,
  flagsFromContentHead,
  prioritizeOpenTabSnapshots,
} from './fileTypeFlags';

describe('flagsFromExtension', () => {
  it('classifies common extensions without content peek', () => {
    expect(flagsFromExtension('/a/app.log')).toMatchObject({
      isXml: false,
      isJson: false,
      isMarkdown: false,
      needsContentPeek: false,
    });
    expect(flagsFromExtension('/a/config.xml')).toMatchObject({
      isXml: true,
      needsContentPeek: false,
    });
    expect(flagsFromExtension('/a/readme.md')).toMatchObject({
      isMarkdown: true,
      needsContentPeek: false,
    });
  });

  it('marks json and unknown extensions for a head peek', () => {
    expect(flagsFromExtension('/a/data.json').needsContentPeek).toBe(true);
    expect(flagsFromExtension('/a/strange.bin').needsContentPeek).toBe(true);
  });
});

describe('flagsFromContentHead', () => {
  it('detects xml from head', () => {
    const flags = flagsFromContentHead('/a/file.cfg', '<?xml version="1.0"?><root/>', () => false);
    expect(flags.isXml).toBe(true);
    expect(flags.isJson).toBe(false);
  });

  it('treats json log streams as logs (not json viewer)', () => {
    const flags = flagsFromContentHead(
      '/a/events.json',
      '{"@timestamp":"2026-01-01","message":"x"}\n',
      () => true
    );
    expect(flags.isJson).toBe(false);
  });
});

describe('prioritizeOpenTabSnapshots', () => {
  it('moves the preferred active tab to the front', () => {
    const snaps = [
      { filePaths: ['/a.log'] },
      { filePaths: ['/b.log'] },
      { filePaths: ['/c.log'] },
    ];
    const ordered = prioritizeOpenTabSnapshots(snaps, '/b.log', (p) => p.join('|'));
    expect(ordered.map((s) => s.filePaths[0])).toEqual(['/b.log', '/a.log', '/c.log']);
  });
});
