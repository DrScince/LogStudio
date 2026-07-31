import type { AppSettings, DirectoryMeta } from './settings';

export interface VirtualFolder {
  id: string;
  name: string;
  filePaths: string[];
  icon?: string;
  color?: string;
}

/** Persisted open tab belonging to a workspace (folder / virtual-folder files). */
export interface WorkspaceOpenTab {
  filePaths: string[];
}

export interface Workspace {
  id: string;
  name: string;
  logDirectories: string[];
  virtualFolders: VirtualFolder[];
  /** Open tabs that belong to this workspace's folders (restored on switch). */
  openTabs?: WorkspaceOpenTab[];
  /** openTabKey of the last active workspace-bound tab */
  activeOpenTabKey?: string;
}

export const VIRTUAL_FOLDER_PREFIX = 'virtual:';

export function isVirtualFolderId(id: string): boolean {
  return id.startsWith(VIRTUAL_FOLDER_PREFIX);
}

export function toVirtualFolderId(id: string): string {
  return `${VIRTUAL_FOLDER_PREFIX}${id}`;
}

export function fromVirtualFolderId(activeId: string): string | null {
  if (!isVirtualFolderId(activeId)) return null;
  return activeId.slice(VIRTUAL_FOLDER_PREFIX.length);
}

export function createWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createVirtualFolder(name: string, filePaths: string[] = []): VirtualFolder {
  return {
    id: createWorkspaceId(),
    name: name.trim() || 'Virtual folder',
    filePaths: [...filePaths],
  };
}

export function createWorkspace(
  name: string,
  logDirectories: string[] = [],
  virtualFolders: VirtualFolder[] = []
): Workspace {
  return {
    id: createWorkspaceId(),
    name: name.trim() || 'Workspace',
    logDirectories: [...logDirectories],
    virtualFolders: virtualFolders.map((v) => ({
      ...v,
      filePaths: [...v.filePaths],
    })),
  };
}

function normalizeVirtualFolders(folders: VirtualFolder[] | undefined): VirtualFolder[] {
  return (folders ?? []).map((v) => ({
    ...v,
    filePaths: [...(v.filePaths ?? [])],
  }));
}

/** Ensure workspaces exist; migrate legacy logDirectories into a default workspace. */
export function ensureWorkspaces(
  settings: AppSettings,
  defaultName = 'Default'
): AppSettings {
  const existing = (settings.workspaces ?? []).map((w) => ({
    ...w,
    logDirectories: [...(w.logDirectories ?? [])],
    virtualFolders: normalizeVirtualFolders(w.virtualFolders),
  }));

  if (existing.length > 0) {
    const activeId =
      existing.some((w) => w.id === settings.activeWorkspaceId)
        ? settings.activeWorkspaceId
        : existing[0].id;
    const active = existing.find((w) => w.id === activeId)!;
    const dirs =
      active.logDirectories.length > 0
        ? active.logDirectories
        : (settings.logDirectories ?? []);
    const virtualFolders = normalizeVirtualFolders(
      Array.isArray(active.virtualFolders) ? active.virtualFolders : settings.virtualFolders
    );

    const workspaces = existing.map((w) =>
      w.id === activeId
        ? { ...w, logDirectories: [...dirs], virtualFolders }
        : {
            ...w,
            virtualFolders: normalizeVirtualFolders(
              Array.isArray(w.virtualFolders) ? w.virtualFolders : []
            ),
          }
    );
    return {
      ...settings,
      workspaces,
      activeWorkspaceId: activeId,
      logDirectories: [...dirs],
      virtualFolders: normalizeVirtualFolders(virtualFolders),
    };
  }

  const ws = createWorkspace(
    defaultName,
    settings.logDirectories ?? [],
    settings.virtualFolders ?? []
  );
  return {
    ...settings,
    workspaces: [ws],
    activeWorkspaceId: ws.id,
    logDirectories: [...ws.logDirectories],
    virtualFolders: normalizeVirtualFolders(ws.virtualFolders),
  };
}

/** Keep active workspace dirs + virtual folders in sync with top-level settings. */
export function syncActiveWorkspaceDirs(settings: AppSettings): AppSettings {
  const workspaces = (settings.workspaces ?? []).map((w) =>
    w.id === settings.activeWorkspaceId
      ? {
          ...w,
          logDirectories: [...(settings.logDirectories ?? [])],
          virtualFolders: normalizeVirtualFolders(settings.virtualFolders),
        }
      : {
          ...w,
          virtualFolders: normalizeVirtualFolders(w.virtualFolders),
        }
  );
  return {
    ...settings,
    workspaces,
    virtualFolders: normalizeVirtualFolders(settings.virtualFolders),
  };
}

export function getActiveWorkspace(settings: AppSettings): Workspace | undefined {
  return (settings.workspaces ?? []).find((w) => w.id === settings.activeWorkspaceId);
}

export function pathBelongsToDirectories(filePath: string, directories: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return directories.some((dir) => {
    const normDir = dir.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === normDir || normalized.startsWith(normDir + '/');
  });
}

export function pathBelongsToWorkspace(
  filePath: string,
  directories: string[],
  virtualFolders: VirtualFolder[] = []
): boolean {
  if (pathBelongsToDirectories(filePath, directories)) return true;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return virtualFolders.some((folder) =>
    folder.filePaths.some((p) => p.replace(/\\/g, '/').toLowerCase() === normalized)
  );
}

export function tabFilePaths(tab: { filePath: string; filePaths?: string[] }): string[] {
  return tab.filePaths && tab.filePaths.length > 0 ? [...tab.filePaths] : [tab.filePath];
}

export function openTabKey(paths: string[]): string {
  return [...paths]
    .map((p) => p.replace(/\\/g, '/').toLowerCase())
    .sort()
    .join('|');
}

export function snapshotWorkspaceOpenTabs(
  tabs: { id: string; filePath: string; filePaths?: string[] }[],
  activeTabId: string | null,
  directories: string[],
  virtualFolders: VirtualFolder[] = []
): Pick<Workspace, 'openTabs' | 'activeOpenTabKey'> {
  const bound = tabs.filter((tab) => {
    const paths = tabFilePaths(tab);
    return paths.length > 0 && paths.every((p) => pathBelongsToWorkspace(p, directories, virtualFolders));
  });
  const openTabs: WorkspaceOpenTab[] = bound.map((tab) => ({ filePaths: tabFilePaths(tab) }));
  const active = activeTabId ? bound.find((t) => t.id === activeTabId) : undefined;
  return {
    openTabs,
    activeOpenTabKey: active ? openTabKey(tabFilePaths(active)) : undefined,
  };
}

export function filterValidOpenTabs(
  openTabs: WorkspaceOpenTab[] | undefined,
  directories: string[],
  virtualFolders: VirtualFolder[] = []
): WorkspaceOpenTab[] {
  return (openTabs ?? [])
    .map((tab) => ({
      filePaths: (tab.filePaths ?? []).filter((p) =>
        pathBelongsToWorkspace(p, directories, virtualFolders)
      ),
    }))
    .filter((tab) => tab.filePaths.length > 0);
}

export function pruneDirectoryMeta(
  meta: Record<string, DirectoryMeta>,
  directories: string[]
): Record<string, DirectoryMeta> {
  const keep = new Set(directories);
  const next: Record<string, DirectoryMeta> = {};
  for (const [path, value] of Object.entries(meta)) {
    if (keep.has(path)) next[path] = value;
  }
  return next;
}

export function fileBasename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath;
}
