import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import LogViewer from './components/LogViewer';
import XmlViewer from './components/XmlViewer';
import JsonViewer from './components/JsonViewer';
import MarkdownViewer from './components/MarkdownViewer';
import { detectLogFormat } from './utils/logFormatDetector';
import Sidebar from './components/Sidebar';
import NamespaceToolbar from './components/NamespaceToolbar';
import Toolbar from './components/Toolbar';
import { Tab } from './components/Toolbar';
import SettingsPanel from './components/SettingsPanel';
import AboutPanel from './components/AboutPanel';
import TitleBar from './components/TitleBar';
import Toast from './components/Toast';
import { loadSettings, saveSettings, AppSettings, DirectoryMeta } from './utils/settings';
import {
  createWorkspace,
  createVirtualFolder,
  ensureWorkspaces,
  pathBelongsToWorkspace,
  syncActiveWorkspaceDirs,
  isVirtualFolderId,
  toVirtualFolderId,
  fromVirtualFolderId,
  tabFilePaths,
  openTabKey,
  snapshotWorkspaceOpenTabs,
  filterValidOpenTabs,
  VirtualFolder,
  WorkspaceOpenTab,
} from './utils/workspaces';
import {
  clearAllStructuredViewerUi,
  clearStructuredViewerUi,
  pruneStructuredViewerUi,
} from './utils/viewerUiState';
import { I18nProvider, useTranslation } from './i18n';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => ensureWorkspaces(loadSettings()));
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [resetFilterTrigger, setResetFilterTrigger] = useState(0);
  const [isFileSidebarCollapsed, setIsFileSidebarCollapsed] = useState(false);
  const [activeDirectory, setActiveDirectory] = useState<string>(() => {
    const s = ensureWorkspaces(loadSettings());
    if (s.logDirectories[0]) return s.logDirectories[0];
    if (s.virtualFolders[0]) return toVirtualFolderId(s.virtualFolders[0].id);
    return '';
  });

  type UpdateState =
    | { phase: 'available'; version: string; portable: boolean; releaseUrl?: string }
    | { phase: 'downloading'; percent: number }
    | { phase: 'ready'; version: string }
    | { phase: 'error'; message: string };

  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [noUpdateAvailable, setNoUpdateAvailable] = useState(false);
  const manualCheckPending = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const tabsPersistReady = useRef(false);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeTabIdRef.current = activeTabId;

  const canReadFile = useCallback(async (filePath: string): Promise<boolean> => {
    if (!window.electronAPI) return false;
    const result = await window.electronAPI.readLogFile(filePath);
    return result.success;
  }, []);

  // Apply theme to root element
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [settings.theme]);

  // Apply font size to root element
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--base-font-size', `${settings.fontSize}px`);
  }, [settings.fontSize]);

  // Active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentLogFile = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return null;
    // Wenn mehrere Dateien, verwende null für filePath (damit loadLogFile nicht aufgerufen wird)
    if (activeTab.filePaths && activeTab.filePaths.length > 1) {
      return null;
    }
    return activeTab.filePaths && activeTab.filePaths.length === 1
      ? activeTab.filePaths[0] 
      : activeTab.filePath;
  }, [tabs, activeTabId]);

  const currentLogFiles = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return null;
    // Nur zurückgeben wenn wirklich mehrere Dateien
    return activeTab.filePaths && activeTab.filePaths.length > 1
      ? activeTab.filePaths
      : null;
  }, [tabs, activeTabId]);

  const activeTabFiles = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return [];
    // Alle Dateien aus dem aktiven Tab zurückgeben (für Highlighting in Sidebar)
    if (activeTab.filePaths && activeTab.filePaths.length > 1) {
      return activeTab.filePaths;
    }
    return activeTab.filePath ? [activeTab.filePath] : [];
  }, [tabs, activeTabId]);
  const selectedNamespaces = activeTab?.selectedNamespaces || [];
  const namespaces = activeTab?.namespaces || [];
  const namespaceCounts = activeTab?.namespaceCounts || {};

  useEffect(() => {
    // Set default log directory if not set
    if (settings.logDirectories.length === 0 && window.electronAPI) {
      window.electronAPI.getDefaultLogDirectory().then((result) => {
        if (result.success && result.path) {
          const defaultPath = result.path || '';
          setSettings((prev) =>
            syncActiveWorkspaceDirs({
              ...prev,
              logDirectory: defaultPath,
              logDirectories: [defaultPath],
            })
          );
          setActiveDirectory(defaultPath);
        }
      });
    }
  }, []);

  // Keep activeDirectory valid when logDirectories / virtualFolders change
  useEffect(() => {
    const dirs = settings.logDirectories;
    const vfs = settings.virtualFolders ?? [];
    const pickFallback = () =>
      dirs[0] ?? (vfs[0] ? toVirtualFolderId(vfs[0].id) : '');

    if (isVirtualFolderId(activeDirectory)) {
      const id = fromVirtualFolderId(activeDirectory);
      if (!id || !vfs.some((v) => v.id === id)) {
        setActiveDirectory(pickFallback());
      }
      return;
    }

    if (dirs.length === 0 && vfs.length === 0) {
      setActiveDirectory('');
    } else if (activeDirectory && !dirs.includes(activeDirectory)) {
      setActiveDirectory(pickFallback());
    } else if (!activeDirectory) {
      setActiveDirectory(pickFallback());
    }
  }, [settings.logDirectories, settings.virtualFolders]);

  // Track active file: switch folder tab to the directory containing the active file
  useEffect(() => {
    const filePath = currentLogFile ?? (currentLogFiles && currentLogFiles[0]);
    if (!filePath) return;
    const normalized = filePath.replace(/\\/g, '/');
    const match = settings.logDirectories.find((dir) => {
      const normDir = dir.replace(/\\/g, '/').replace(/\/$/, '');
      return normalized.startsWith(normDir + '/');
    });
    if (match && match !== activeDirectory) {
      setActiveDirectory(match);
      return;
    }
    const vf = (settings.virtualFolders ?? []).find((folder) =>
      folder.filePaths.some(
        (p) => p.replace(/\\/g, '/').toLowerCase() === normalized.toLowerCase()
      )
    );
    if (vf) {
      const vid = toVirtualFolderId(vf.id);
      if (vid !== activeDirectory) setActiveDirectory(vid);
    }
  }, [currentLogFile, currentLogFiles]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    window.electronAPI?.onUpdateAvailable?.((info) => {
      manualCheckPending.current = false;
      setCheckingForUpdates(false);
      setUpdateState({ phase: 'available', version: info.version, portable: info.portable, releaseUrl: info.releaseUrl });
    });
    window.electronAPI?.onDownloadProgress?.((info) => {
      setUpdateState({ phase: 'downloading', percent: info.percent });
    });
    window.electronAPI?.onUpdateDownloaded?.((info) => {
      setUpdateState({ phase: 'ready', version: info.version });
    });
    window.electronAPI?.onUpdateError?.((info) => {
      manualCheckPending.current = false;
      setCheckingForUpdates(false);
      setUpdateState({ phase: 'error', message: info.message });
    });
    window.electronAPI?.onUpdateNotAvailable?.(() => {
      if (manualCheckPending.current) {
        manualCheckPending.current = false;
        setCheckingForUpdates(false);
        setNoUpdateAvailable(true);
        setTimeout(() => setNoUpdateAvailable(false), 3000);
      }
    });
    return () => {
      window.electronAPI?.removeUpdateListeners?.();
    };
  }, []);

  const handleDownloadUpdate = async () => {
    setUpdateState({ phase: 'downloading', percent: 0 });
    await window.electronAPI?.downloadUpdate();
  };

  const handleCheckForUpdates = async () => {
    if (checkingForUpdates) return;
    setCheckingForUpdates(true);
    setNoUpdateAvailable(false);
    manualCheckPending.current = true;
    const result = await window.electronAPI?.checkForUpdates();
    if (result && !result.success) {
      // Not packaged or immediate error
      manualCheckPending.current = false;
      setCheckingForUpdates(false);
      setNoUpdateAvailable(true);
      setTimeout(() => setNoUpdateAvailable(false), 3000);
    }
  };

  /** Close tabs that belonged to the workspace being left; keep standalone opened files. */
  const keepTabsWhenLeavingWorkspace = (
    currentTabs: Tab[],
    leavingDirs: string[],
    leavingVfs: VirtualFolder[],
    enteringDirs: string[],
    enteringVfs: VirtualFolder[]
  ): Tab[] =>
    currentTabs.filter((tab) => {
      const paths = tabFilePaths(tab);
      const boundToLeaving = paths.every((p) =>
        pathBelongsToWorkspace(p, leavingDirs, leavingVfs)
      );
      if (!boundToLeaving) return true;
      return paths.some((p) => pathBelongsToWorkspace(p, enteringDirs, enteringVfs));
    });

  const detectFileFlags = useCallback(async (filePath: string) => {
    const lp = filePath.toLowerCase();
    let isMarkdown = lp.endsWith('.md') || lp.endsWith('.markdown');
    let isXml = lp.endsWith('.xml');
    let isJson = false;
    if (!window.electronAPI) return { isXml, isJson, isMarkdown };
    if (isMarkdown) return { isXml: false, isJson: false, isMarkdown: true };
    try {
      const result = await window.electronAPI.readLogFile(filePath);
      if (!result.success || !result.content) return { isXml, isJson, isMarkdown };
      const trimmed = result.content.trimStart();
      const needsContentCheck =
        lp.endsWith('.json') || (!isXml && !lp.endsWith('.log') && !lp.endsWith('.txt'));
      if (needsContentCheck) {
        if (!isXml && (trimmed.startsWith('<?xml') || /^<[A-Za-z][A-Za-z0-9\-_]*[\s>]/.test(trimmed))) {
          isXml = true;
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const fmt = detectLogFormat(result.content);
          const isJsonLog = fmt.name === 'json-ecs' || fmt.name === 'json-multiline';
          isJson = !isJsonLog;
        }
      }
    } catch {
      /* ignore */
    }
    return { isXml, isJson, isMarkdown };
  }, []);

  const createTabFromPaths = useCallback(
    async (filePaths: string[]): Promise<Tab | null> => {
      const paths = filePaths.filter(Boolean);
      if (paths.length === 0) return null;
      if (paths.length === 1) {
        if (!(await canReadFile(paths[0]))) return null;
        const flags = await detectFileFlags(paths[0]);
        return {
          id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          filePath: paths[0],
          selectedNamespaces: [],
          namespaces: [],
          namespaceCounts: {},
          ...flags,
        };
      }
      const readable: string[] = [];
      for (const p of paths) {
        if (await canReadFile(p)) readable.push(p);
      }
      if (readable.length === 0) return null;
      if (readable.length === 1) return await createTabFromPaths(readable);
      return {
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        filePath: readable[0],
        filePaths: readable,
        selectedNamespaces: [],
        namespaces: [],
        namespaceCounts: {},
      };
    },
    [canReadFile, detectFileFlags]
  );

  const restoreOpenTabs = useCallback(
    async (
      snapshots: WorkspaceOpenTab[],
      existing: Tab[],
      preferredActiveKey?: string
    ): Promise<{ tabs: Tab[]; activeId: string | null }> => {
      const next = [...existing];
      const keys = new Set(next.map((t) => openTabKey(tabFilePaths(t))));
      for (const snap of snapshots) {
        const key = openTabKey(snap.filePaths);
        if (keys.has(key)) continue;
        const tab = await createTabFromPaths(snap.filePaths);
        if (!tab) continue;
        next.push(tab);
        keys.add(key);
      }
      const preferred =
        (preferredActiveKey
          ? next.find((t) => openTabKey(tabFilePaths(t)) === preferredActiveKey)
          : undefined) ??
        next.find((t) => t.id === activeTabIdRef.current) ??
        next[0];
      return { tabs: next, activeId: preferred?.id ?? null };
    },
    [createTabFromPaths]
  );

  const pickActiveSource = (dirs: string[], vfs: VirtualFolder[]) =>
    dirs[0] ?? (vfs[0] ? toVirtualFolderId(vfs[0].id) : '');

  // Restore workspace-bound tabs once on startup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ws = settings.workspaces.find((w) => w.id === settings.activeWorkspaceId);
      const snapshots = filterValidOpenTabs(
        ws?.openTabs,
        settings.logDirectories ?? [],
        settings.virtualFolders ?? []
      );
      if (snapshots.length > 0) {
        const restored = await restoreOpenTabs(snapshots, [], ws?.activeOpenTabKey);
        if (!cancelled) {
          setTabs(restored.tabs);
          setActiveTabId(restored.activeId);
          pruneStructuredViewerUi(restored.tabs.map((t) => t.id));
        }
      }
      tabsPersistReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startup only
  }, []);

  // Persist open workspace tabs into the active workspace
  useEffect(() => {
    if (!tabsPersistReady.current) return;
    setSettings((prev) => {
      const snap = snapshotWorkspaceOpenTabs(
        tabs,
        activeTabId,
        prev.logDirectories ?? [],
        prev.virtualFolders ?? []
      );
      const active = prev.workspaces.find((w) => w.id === prev.activeWorkspaceId);
      if (!active) return prev;
      const same =
        JSON.stringify(active.openTabs ?? []) === JSON.stringify(snap.openTabs ?? []) &&
        (active.activeOpenTabKey ?? '') === (snap.activeOpenTabKey ?? '');
      if (same) return prev;
      return {
        ...prev,
        workspaces: prev.workspaces.map((w) =>
          w.id === prev.activeWorkspaceId ? { ...w, ...snap } : w
        ),
      };
    });
  }, [tabs, activeTabId]);

  const handleSettingsChange = (newSettings: AppSettings) => {
    const leavingDirs = settings.logDirectories ?? [];
    const leavingVfs = settings.virtualFolders ?? [];
    const next = syncActiveWorkspaceDirs(ensureWorkspaces(newSettings));
    setSettings(next);
    setActiveDirectory(pickActiveSource(next.logDirectories, next.virtualFolders ?? []));
    setTabs((prev) =>
      keepTabsWhenLeavingWorkspace(
        prev,
        leavingDirs,
        leavingVfs,
        next.logDirectories,
        next.virtualFolders ?? []
      )
    );
  };

  const patchDirectories = (
    updater: (dirs: string[]) => string[],
    extra?: (prev: AppSettings, dirs: string[]) => Partial<AppSettings>
  ) => {
    setSettings((prev) => {
      const dirs = updater(prev.logDirectories ?? []);
      const next: AppSettings = {
        ...prev,
        logDirectories: dirs,
        ...(extra ? extra(prev, dirs) : {}),
      };
      return syncActiveWorkspaceDirs(next);
    });
  };

  const handleAddDirectory = (newPath: string) => {
    patchDirectories((dirs) => (dirs.includes(newPath) ? dirs : [...dirs, newPath]));
    setActiveDirectory(newPath);
  };

  const handleRemoveDirectory = (dir: string) => {
    patchDirectories(
      (dirs) => dirs.filter((d) => d !== dir),
      (prev) => {
        const meta = { ...prev.directoryMeta };
        delete meta[dir];
        return { directoryMeta: meta };
      }
    );
  };

  const handleRenameDirectory = (dir: string, label: string) => {
    setSettings((prev) => {
      const current = prev.directoryMeta[dir] ?? {};
      const next: DirectoryMeta = { ...current };
      if (label) {
        next.label = label;
      } else {
        delete next.label;
      }
      const meta = { ...prev.directoryMeta };
      if (Object.keys(next).length === 0) {
        delete meta[dir];
      } else {
        meta[dir] = next;
      }
      return { ...prev, directoryMeta: meta };
    });
  };

  const handleDirectoryMetaChange = (meta: Record<string, DirectoryMeta>) => {
    setSettings((prev) => ({ ...prev, directoryMeta: meta }));
  };

  const handleReorderDirectories = (dirs: string[]) => {
    patchDirectories(() => dirs);
  };

  const handleSwitchWorkspace = async (id: string) => {
    if (id === settings.activeWorkspaceId) return;
    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;
    const synced = syncActiveWorkspaceDirs(settings);
    const target = synced.workspaces.find((w) => w.id === id);
    if (!target) return;

    const leavingDirs = synced.logDirectories ?? [];
    const leavingVfs = synced.virtualFolders ?? [];
    const leavingSnap = snapshotWorkspaceOpenTabs(
      currentTabs,
      currentActiveId,
      leavingDirs,
      leavingVfs
    );
    const enteringDirs = [...target.logDirectories];
    const enteringVfs = (target.virtualFolders ?? []).map((v) => ({
      ...v,
      filePaths: [...v.filePaths],
    }));

    setSettings({
      ...synced,
      activeWorkspaceId: id,
      logDirectories: enteringDirs,
      virtualFolders: enteringVfs,
      workspaces: synced.workspaces.map((w) => {
        if (w.id === synced.activeWorkspaceId) {
          return {
            ...w,
            logDirectories: [...leavingDirs],
            virtualFolders: leavingVfs.map((v) => ({ ...v, filePaths: [...v.filePaths] })),
            ...leavingSnap,
          };
        }
        if (w.id === id) {
          return { ...w, logDirectories: enteringDirs, virtualFolders: enteringVfs };
        }
        return w;
      }),
    });
    setActiveDirectory(pickActiveSource(enteringDirs, enteringVfs));

    const kept = keepTabsWhenLeavingWorkspace(
      currentTabs,
      leavingDirs,
      leavingVfs,
      enteringDirs,
      enteringVfs
    );
    const snapshots = filterValidOpenTabs(target.openTabs, enteringDirs, enteringVfs);
    const restored = await restoreOpenTabs(snapshots, kept, target.activeOpenTabKey);
    setTabs(restored.tabs);
    setActiveTabId(restored.activeId);
    pruneStructuredViewerUi(restored.tabs.map((t) => t.id));
  };

  const handleCreateWorkspace = async () => {
    const name = t('workspace.newName', { n: settings.workspaces.length + 1 });
    const ws = createWorkspace(name, [], []);
    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;
    const leavingDirs = settings.logDirectories ?? [];
    const leavingVfs = settings.virtualFolders ?? [];
    const leavingSnap = snapshotWorkspaceOpenTabs(
      currentTabs,
      currentActiveId,
      leavingDirs,
      leavingVfs
    );

    setSettings((prev) => {
      const synced = syncActiveWorkspaceDirs(prev);
      return {
        ...synced,
        workspaces: [
          ...synced.workspaces.map((w) =>
            w.id === synced.activeWorkspaceId ? { ...w, ...leavingSnap } : w
          ),
          ws,
        ],
        activeWorkspaceId: ws.id,
        logDirectories: [],
        virtualFolders: [],
      };
    });
    setActiveDirectory('');
    const kept = keepTabsWhenLeavingWorkspace(currentTabs, leavingDirs, leavingVfs, [], []);
    setTabs(kept);
    pruneStructuredViewerUi(kept.map((t) => t.id));
    setActiveTabId((current) =>
      current && kept.some((t) => t.id === current) ? current : kept[0]?.id ?? null
    );
  };

  const handleRenameWorkspace = (id: string, name: string) => {
    if (!name) return;
    setSettings((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
    }));
  };

  const handleDeleteWorkspace = async (id: string) => {
    if (settings.workspaces.length <= 1) return;
    const currentTabs = tabsRef.current;
    const switching = settings.activeWorkspaceId === id;
    const workspaces = settings.workspaces.filter((w) => w.id !== id);
    const nextActive = switching
      ? workspaces[0]
      : workspaces.find((w) => w.id === settings.activeWorkspaceId)!;
    const enteringDirs = [...nextActive.logDirectories];
    const enteringVfs = (nextActive.virtualFolders ?? []).map((v) => ({
      ...v,
      filePaths: [...v.filePaths],
    }));

    if (switching) {
      const leavingDirs = settings.logDirectories ?? [];
      const leavingVfs = settings.virtualFolders ?? [];
      setSettings({
        ...settings,
        workspaces,
        activeWorkspaceId: nextActive.id,
        logDirectories: enteringDirs,
        virtualFolders: enteringVfs,
      });
      setActiveDirectory(pickActiveSource(enteringDirs, enteringVfs));
      const kept = keepTabsWhenLeavingWorkspace(
        currentTabs,
        leavingDirs,
        leavingVfs,
        enteringDirs,
        enteringVfs
      );
      const snapshots = filterValidOpenTabs(nextActive.openTabs, enteringDirs, enteringVfs);
      const restored = await restoreOpenTabs(snapshots, kept, nextActive.activeOpenTabKey);
      setTabs(restored.tabs);
      setActiveTabId(restored.activeId);
      pruneStructuredViewerUi(restored.tabs.map((t) => t.id));
    } else {
      setSettings((prev) => ({ ...prev, workspaces }));
    }
  };

  const updateVirtualFolders = (updater: (folders: VirtualFolder[]) => VirtualFolder[]) => {
    setSettings((prev) =>
      syncActiveWorkspaceDirs({
        ...prev,
        virtualFolders: updater(prev.virtualFolders ?? []),
      })
    );
  };

  const handleCreateVirtualFolder = (name?: string) => {
    const folder = createVirtualFolder(
      name?.trim() || t('virtualFolder.defaultName', { n: (settings.virtualFolders?.length ?? 0) + 1 })
    );
    updateVirtualFolders((folders) => [...folders, folder]);
    setActiveDirectory(toVirtualFolderId(folder.id));
  };

  const handleRenameVirtualFolder = (id: string, name: string) => {
    if (!name.trim()) return;
    updateVirtualFolders((folders) =>
      folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f))
    );
  };

  const handleDeleteVirtualFolder = (id: string) => {
    updateVirtualFolders((folders) => folders.filter((f) => f.id !== id));
  };

  const handleUpdateVirtualFolder = (id: string, patch: Partial<VirtualFolder>) => {
    updateVirtualFolders((folders) =>
      folders.map((f) => {
        if (f.id !== id) return f;
        const next: VirtualFolder = { ...f, ...patch };
        if ('icon' in patch && !patch.icon) delete next.icon;
        if ('color' in patch && !patch.color) delete next.color;
        return next;
      })
    );
  };

  const handleAddFilesToVirtualFolder = async (id: string) => {
    if (!window.electronAPI?.showOpenFilesDialog) return;
    const result = await window.electronAPI.showOpenFilesDialog();
    if (!result.success || !result.filePaths?.length) return;
    updateVirtualFolders((folders) =>
      folders.map((f) => {
        if (f.id !== id) return f;
        const existing = new Set(f.filePaths.map((p) => p.replace(/\\/g, '/').toLowerCase()));
        const added = result.filePaths!.filter(
          (p) => !existing.has(p.replace(/\\/g, '/').toLowerCase())
        );
        return { ...f, filePaths: [...f.filePaths, ...added] };
      })
    );
  };

  const handleRemoveFileFromVirtualFolder = (id: string, filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    updateVirtualFolders((folders) =>
      folders.map((f) =>
        f.id !== id
          ? f
          : {
              ...f,
              filePaths: f.filePaths.filter(
                (p) => p.replace(/\\/g, '/').toLowerCase() !== normalized
              ),
            }
      )
    );
  };

  const handleThemeToggle = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    setSettings((prev) => ({ ...prev, theme: newTheme }));
  };

  const handleOpenFile = async () => {
    try {
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
        alert('Error: Electron API is not available. Please restart the application.');
        return;
      }

      console.log('Opening file dialog...');
      const result = await window.electronAPI.showOpenDialog();
      console.log('File dialog result:', result);

      if (result.success && result.filePath) {
        console.log('Selected file:', result.filePath);
        openFileInTab(result.filePath);
      } else if (result.canceled) {
        console.log('File dialog was canceled');
      } else {
        console.error('Error opening file dialog:', result.error);
        alert(`Error opening file: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Exception in handleOpenFile:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const openFileInTab = useCallback(async (filePath: string): Promise<boolean> => {
    // Check if file is already open in a single-file tab (not a group tab)
    const existingTab = tabs.find((tab) => 
      tab.filePath === filePath && 
      (!tab.filePaths || tab.filePaths.length <= 1)
    );
    
    if (existingTab) {
      // Switch to existing tab
      setActiveTabId(existingTab.id);
      return true;
    }

    if (!window.electronAPI) return false;

    // Create a new tab — detect type by extension first, then by content
    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const lp = filePath.toLowerCase();
    let isMarkdown = lp.endsWith('.md') || lp.endsWith('.markdown');
    let isXml = lp.endsWith('.xml');
    let isJson = false;

    try {
      const result = await window.electronAPI.readLogFile(filePath);
      if (!result.success) return false;

      if (!isMarkdown && result.content) {
        const trimmed = result.content.trimStart();
        const needsContentCheck =
          lp.endsWith('.json') || (!isXml && !lp.endsWith('.log') && !lp.endsWith('.txt'));
        if (needsContentCheck) {
          if (!isXml && (trimmed.startsWith('<?xml') || /^<[A-Za-z][A-Za-z0-9\-_]*[\s>]/.test(trimmed))) {
            isXml = true;
          } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const fmt = detectLogFormat(result.content);
            const isJsonLog = fmt.name === 'json-ecs' || fmt.name === 'json-multiline';
            isJson = !isJsonLog;
          }
        }
      }
    } catch {
      return false;
    }

    const newTab: Tab = {
      id: newTabId,
      filePath,
      isXml,
      isJson,
      isMarkdown,
      selectedNamespaces: [],
      namespaces: [],
      namespaceCounts: {},
    };
    
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
    return true;
  }, [tabs]);

  const openMultipleFilesInTab = useCallback((filePaths: string[]) => {
    if (filePaths.length === 0) return;
    
    if (filePaths.length === 1) {
      openFileInTab(filePaths[0]);
      return;
    }

    // Für mehrere Dateien: Erstelle einen Tab mit einem kombinierten Identifier
    const combinedId = filePaths.sort().join('|');
    const existingTab = tabs.find((tab) => {
      if (Array.isArray(tab.filePaths)) {
        return tab.filePaths.sort().join('|') === combinedId;
      }
      return false;
    });

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newTab: Tab = {
        id: newTabId,
        filePath: filePaths[0], // Für Kompatibilität
        filePaths: filePaths, // Neue Eigenschaft für mehrere Dateien
        selectedNamespaces: [],
        namespaces: [],
        namespaceCounts: {},
      };
      
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTabId);
    }
  }, [tabs, openFileInTab]);

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    clearStructuredViewerUi(tabId);

    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);
      
      // If the closed tab was active, switch to the next tab
      if (tabId === activeTabId) {
        if (newTabs.length > 0) {
          // Switch to previous tab or first if it was the last
          const closedIndex = prev.findIndex((tab) => tab.id === tabId);
          const newActiveIndex = closedIndex > 0 ? closedIndex - 1 : 0;
          setActiveTabId(newTabs[newActiveIndex]?.id || null);
        } else {
          setActiveTabId(null);
        }
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const handleLogFileSelect = useCallback((filePath: string | null) => {
    if (filePath) {
      openFileInTab(filePath);
    }
  }, [openFileInTab]);

  const handleLogFilesSelect = useCallback((filePaths: string[], ctrlKey?: boolean) => {
    if (filePaths.length > 0) {
      // Mit Strg: Dateien zum aktiven Tab hinzufügen
      if (ctrlKey && activeTabId) {
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.id === activeTabId) {
              // Kombiniere bestehende Dateien mit neuen, entferne Duplikate
              const existingFiles = tab.filePaths && tab.filePaths.length > 1 
                ? tab.filePaths 
                : tab.filePath 
                  ? [tab.filePath] 
                  : [];
              const allFiles = [...new Set([...existingFiles, ...filePaths])];
              
              return {
                ...tab,
                filePath: allFiles[0], // Für Kompatibilität
                filePaths: allFiles.length > 1 ? allFiles : undefined,
              };
            }
            return tab;
          })
        );
      } else {
        // Ohne Strg: Immer neuen Tab öffnen
        openMultipleFilesInTab(filePaths);
      }
    }
  }, [activeTabId, openMultipleFilesInTab]);

  const handleNamespaceToggle = useCallback((namespace: string) => {
    if (!activeTabId) return;
    
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        
        const isCurrentlySelected = tab.selectedNamespaces.includes(namespace);
        
        if (isCurrentlySelected) {
          // Deselect namespace
          return {
            ...tab,
            selectedNamespaces: tab.selectedNamespaces.filter((n) => n !== namespace),
          };
        } else {
          // Select namespace - remove parent and child namespaces
          let newSelection = [...tab.selectedNamespaces];
          
          // Remove all parent namespaces
          newSelection = newSelection.filter((selected) => {
            return !namespace.startsWith(selected + '.');
          });
          
          // Remove all child namespaces
          newSelection = newSelection.filter((selected) => {
            return !selected.startsWith(namespace + '.');
          });
          
          return {
            ...tab,
            selectedNamespaces: [...newSelection, namespace],
          };
        }
      })
    );
  }, [activeTabId]);

  const handleNamespacesChange = useCallback((newNamespaces: string[], newNamespaceCounts: Record<string, number> = {}) => {
    if (!activeTabId) return;
    
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, namespaces: newNamespaces, namespaceCounts: newNamespaceCounts }
          : tab
      )
    );
  }, [activeTabId]);

  const handleResetFilters = useCallback(() => {
    if (!activeTabId) return;
    
    // Reset namespace filters
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, selectedNamespaces: [] } : tab
      )
    );
    
    // Trigger reset in LogViewer
    setResetFilterTrigger(prev => prev + 1);
  }, [activeTabId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only react to actual file drags, not internal tab reordering
    if (!e.dataTransfer.types.includes('Files')) return;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDroppedPaths = useCallback(async (paths: string[]) => {
    setIsDragOver(false);
    if (paths.length === 0) return;

    const failed: string[] = [];

    if (paths.length === 1) {
      const ok = await openFileInTab(paths[0]);
      if (!ok) failed.push(paths[0]);
    } else {
      const readable: string[] = [];
      for (const filePath of paths) {
        if (await canReadFile(filePath)) {
          readable.push(filePath);
        } else {
          failed.push(filePath);
        }
      }

      if (readable.length === 1) {
        await openFileInTab(readable[0]);
      } else if (readable.length > 1) {
        openMultipleFilesInTab(readable);
      }
    }

    if (failed.length > 0) {
      const names = failed.map((p) => p.split(/[\\/]/).pop() ?? p).join(', ');
      setDragError(
        failed.length === paths.length
          ? t('app.unsupportedFiles', { plural: failed.length > 1 ? 'en' : '', names })
          : t('app.unsupportedSomeFiles', { names })
      );
    }
  }, [canReadFile, openFileInTab, openMultipleFilesInTab, t]);

  useEffect(() => {
    window.electronAPI?.onFilesDropped?.(handleDroppedPaths);
    return () => { window.electronAPI?.removeFilesDroppedListener?.(); };
  }, [handleDroppedPaths]);

  useEffect(() => {
    window.electronAPI?.onOpenFileFromCli?.((filePath) => {
      openFileInTab(filePath);
    });
    return () => { window.electronAPI?.removeOpenFileFromCliListener?.(); };
  }, [openFileInTab]);

  // ESC schließt das Drag-Overlay wenn es hängen bleibt
  useEffect(() => {
    if (!isDragOver) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDragOver(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragOver]);

  return (
    <div
      className={`app${isDragOver ? ' drag-over' : ''}`}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="drag-overlay" onClick={() => setIsDragOver(false)}>
          <div className="drag-overlay-content">
            <span className="drag-overlay-icon">📂</span>
            <span className="drag-overlay-text">{t('app.dragOverHint')}</span>
            <span className="drag-overlay-hint">{t('app.dragOverSubhint')}</span>
            <span className="drag-overlay-esc">{t('app.dragOverCancel')}</span>
          </div>
        </div>
      )}
      {dragError && (
        <div className="drag-error-banner" role="alert">
          <span className="drag-error-text">{dragError}</span>
          <button
            className="drag-error-dismiss"
            onClick={() => setDragError(null)}
            aria-label="Fehler schließen"
          >
            ✕
          </button>
        </div>
      )}
      <TitleBar
        onSettingsClick={() => setShowSettings(!showSettings)}
        onAboutClick={() => setShowAbout(!showAbout)}
        onThemeToggle={handleThemeToggle}
        onCheckForUpdates={handleCheckForUpdates}
        currentTheme={settings.theme}
        checkingForUpdates={checkingForUpdates}
        updateAvailable={updateState !== null}
        workspaces={settings.workspaces}
        activeWorkspaceId={settings.activeWorkspaceId}
        onWorkspaceSwitch={handleSwitchWorkspace}
        onWorkspaceCreate={handleCreateWorkspace}
        onWorkspaceRename={handleRenameWorkspace}
        onWorkspaceDelete={handleDeleteWorkspace}
      />
      <Toolbar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onCloseAll={() => {
          clearAllStructuredViewerUi();
          setTabs([]);
          setActiveTabId(null);
        }}
        onCloseOthers={(tabId) => {
          setTabs((prev) => {
            prev.forEach((t) => {
              if (t.id !== tabId) clearStructuredViewerUi(t.id);
            });
            return prev.filter((t) => t.id === tabId);
          });
          setActiveTabId(tabId);
        }}
      />
      {updateState && (
        <div className="update-banner" role="status">
          {updateState.phase === 'available' && (
            <>
              <span className="update-banner-text">
                {t('app.updateAvailable', { version: updateState.version })}
              </span>
              {updateState.portable ? (
                <button
                  className="update-banner-link"
                  onClick={() => window.electronAPI?.openExternal(updateState.releaseUrl!)}
                >
                  Download
                </button>
              ) : (
                <button className="update-banner-link" onClick={handleDownloadUpdate}>
                  {t('app.downloadUpdate')}
                </button>
              )}
              <button
                className="update-banner-dismiss"
                onClick={() => setUpdateState(null)}
                aria-label="Update Hinweis schließen"
              >
                ✕
              </button>
            </>
          )}
          {updateState.phase === 'downloading' && (
            <>
              <span className="update-banner-text">
                {t('app.updateDownloading')} {Math.round(updateState.percent)}%
              </span>
              <div className="update-progress-track">
                <div
                  className="update-progress-fill"
                  style={{ width: `${updateState.percent}%` }}
                />
              </div>
            </>
          )}
          {updateState.phase === 'ready' && (
            <>
              <span className="update-banner-text">
                {t('app.updateReady')}
              </span>
              <button
                className="update-banner-link"
                onClick={() => window.electronAPI?.installUpdate()}
              >
                {t('app.restartNow')}
              </button>
              <button
                className="update-banner-dismiss"
                onClick={() => setUpdateState(null)}
                aria-label="Update Hinweis schließen"
              >
                ✕
              </button>
            </>
          )}
          {updateState.phase === 'error' && (
            <>
              <span className="update-banner-text">
                {t('app.updateError')}
              </span>
              <button
                className="update-banner-dismiss"
                onClick={() => setUpdateState(null)}
                aria-label="Fehler schließen"
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}
      <div className="app-content">
        <Sidebar
          logDirectories={settings.logDirectories}
          activeDirectory={activeDirectory}
          directoryMeta={settings.directoryMeta}
          virtualFolders={settings.virtualFolders}
          onDirectorySelect={setActiveDirectory}
          onAddDirectory={handleAddDirectory}
          onRemoveDirectory={handleRemoveDirectory}
          onRenameDirectory={handleRenameDirectory}
          onDirectoryMetaChange={handleDirectoryMetaChange}
          onReorderDirectories={handleReorderDirectories}
          onCreateVirtualFolder={() => handleCreateVirtualFolder()}
          onRenameVirtualFolder={handleRenameVirtualFolder}
          onDeleteVirtualFolder={handleDeleteVirtualFolder}
          onUpdateVirtualFolder={handleUpdateVirtualFolder}
          onAddFilesToVirtualFolder={handleAddFilesToVirtualFolder}
          onRemoveFileFromVirtualFolder={handleRemoveFileFromVirtualFolder}
          onLogFileSelect={handleLogFileSelect}
          onLogFilesSelect={handleLogFilesSelect}
          onOpenFile={handleOpenFile}
          currentFile={currentLogFile}
          selectedFiles={[]}
          activeTabFiles={activeTabFiles}
          isCollapsed={isFileSidebarCollapsed}
          onToggleCollapse={() => setIsFileSidebarCollapsed((prev) => !prev)}
          includeSubdirectories={settings.includeSubdirectories}
          editorOrder={settings.editorOrder}
        />
        {activeTab?.isXml ? (
          <XmlViewer
            filePath={activeTab.filePath}
            tabId={activeTab.id}
            hotkeys={settings.hotkeys}
            key={activeTabId ?? ''}
          />
        ) : activeTab?.isJson ? (
          <JsonViewer
            filePath={activeTab.filePath}
            tabId={activeTab.id}
            hotkeys={settings.hotkeys}
            key={activeTabId ?? ''}
          />
        ) : activeTab?.isMarkdown ? (
          <MarkdownViewer
            filePath={activeTab.filePath}
            hotkeys={settings.hotkeys}
            theme={settings.theme}
            key={activeTabId ?? ''}
          />
        ) : (
          <>
            <LogViewer
              filePath={currentLogFile}
              filePaths={currentLogFiles}
              schema={settings.logSchema}
              autoRefresh={settings.autoRefresh}
              refreshInterval={settings.refreshInterval}
              selectedNamespaces={selectedNamespaces}
              onNamespacesChange={handleNamespacesChange}
              onResetFilters={handleResetFilters}
              editorOrder={settings.editorOrder}
              autoDetect={settings.autoDetect}
              enabledFormats={settings.enabledFormats}
              hotkeys={settings.hotkeys}
              key={`${activeTabId}-${resetFilterTrigger}`}
            />
            <NamespaceToolbar
              namespaces={namespaces}
              namespaceCounts={namespaceCounts}
              selectedNamespaces={selectedNamespaces}
              onNamespaceToggle={handleNamespaceToggle}
              isVisible={!!currentLogFile || !!(currentLogFiles && currentLogFiles.length > 0)}
            />
          </>
        )}
      </div>
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showAbout && (
        <AboutPanel onClose={() => setShowAbout(false)} />
      )}
      <Toast message={t('app.noUpdateAvailable')} visible={noUpdateAvailable} />
    </div>
  );
}

function AppWithI18n() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  return (
    <I18nProvider
      initialLanguage={settings.language}
      onLanguageChange={(lang) =>
        setSettings((prev) => { const s = { ...prev, language: lang }; saveSettings(s); return s; })
      }
    >
      <App />
    </I18nProvider>
  );
}

export default AppWithI18n;
