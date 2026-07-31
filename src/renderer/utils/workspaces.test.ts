import { describe, it, expect } from 'vitest';
import {
  createWorkspace,
  createVirtualFolder,
  ensureWorkspaces,
  pathBelongsToDirectories,
  pathBelongsToWorkspace,
  syncActiveWorkspaceDirs,
  toVirtualFolderId,
  fromVirtualFolderId,
  isVirtualFolderId,
  snapshotWorkspaceOpenTabs,
  filterValidOpenTabs,
  openTabKey,
} from './workspaces';
import { AppSettings, DEFAULT_HOTKEYS } from './settings';

function baseSettings(partial: Partial<AppSettings> = {}): AppSettings {
  return {
    logSchema: {
      pattern: 'x',
      timestampFormat: 'YYYY',
      fields: { timestamp: 1, level: 2, namespace: 3, message: 4 },
    },
    logDirectory: '',
    logDirectories: [],
    virtualFolders: [],
    directoryMeta: {},
    workspaces: [],
    activeWorkspaceId: '',
    autoRefresh: true,
    refreshInterval: 1000,
    fontSize: 12,
    theme: 'dark',
    editorOrder: ['vscode', 'notepadplusplus', 'notepad'],
    language: 'en',
    autoDetect: true,
    enabledFormats: [],
    includeSubdirectories: false,
    hotkeys: DEFAULT_HOTKEYS,
    ...partial,
  };
}

describe('workspaces', () => {
  it('migrates legacy logDirectories into a default workspace', () => {
    const result = ensureWorkspaces(
      baseSettings({ logDirectories: ['/a', '/b'] }),
      'Default'
    );
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].name).toBe('Default');
    expect(result.workspaces[0].logDirectories).toEqual(['/a', '/b']);
    expect(result.workspaces[0].virtualFolders).toEqual([]);
    expect(result.activeWorkspaceId).toBe(result.workspaces[0].id);
    expect(result.logDirectories).toEqual(['/a', '/b']);
  });

  it('syncs active workspace directories and virtual folders', () => {
    const vf = createVirtualFolder('Pinned', ['/x.log']);
    const ws = createWorkspace('A', ['/old'], [vf]);
    const settings = baseSettings({
      workspaces: [ws],
      activeWorkspaceId: ws.id,
      logDirectories: ['/new'],
      virtualFolders: [{ ...vf, filePaths: ['/y.log'] }],
    });
    const synced = syncActiveWorkspaceDirs(settings);
    expect(synced.workspaces[0].logDirectories).toEqual(['/new']);
    expect(synced.workspaces[0].virtualFolders[0].filePaths).toEqual(['/y.log']);
  });

  it('detects whether a file belongs to workspace directories', () => {
    expect(pathBelongsToDirectories('/logs/app/a.log', ['/logs/app'])).toBe(true);
    expect(pathBelongsToDirectories('/other/a.log', ['/logs/app'])).toBe(false);
  });

  it('keeps virtual-folder files in the workspace', () => {
    const vf = createVirtualFolder('Pinned', ['/elsewhere/app.log']);
    expect(pathBelongsToWorkspace('/elsewhere/app.log', ['/logs'], [vf])).toBe(true);
    expect(pathBelongsToWorkspace('/other/x.log', ['/logs'], [vf])).toBe(false);
  });

  it('snapshots and filters workspace-bound open tabs', () => {
    const vf = createVirtualFolder('Pinned', ['/elsewhere/app.log']);
    const snap = snapshotWorkspaceOpenTabs(
      [
        { id: '1', filePath: '/logs/a.log' },
        { id: '2', filePath: '/tmp/standalone.log' },
        { id: '3', filePath: '/elsewhere/app.log' },
      ],
      '1',
      ['/logs'],
      [vf]
    );
    expect(snap.openTabs).toEqual([
      { filePaths: ['/logs/a.log'] },
      { filePaths: ['/elsewhere/app.log'] },
    ]);
    expect(snap.activeOpenTabKey).toBe(openTabKey(['/logs/a.log']));
    expect(
      filterValidOpenTabs(snap.openTabs, ['/logs'], []).map((t) => t.filePaths)
    ).toEqual([['/logs/a.log']]);
  });

  it('maps virtual folder selection ids', () => {
    expect(isVirtualFolderId(toVirtualFolderId('abc'))).toBe(true);
    expect(fromVirtualFolderId(toVirtualFolderId('abc'))).toBe('abc');
    expect(fromVirtualFolderId('/real/path')).toBe(null);
  });
});
