import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from '../i18n';
import { DirectoryMeta } from '../utils/settings';
import {
  VirtualFolder,
  isVirtualFolderId,
  fromVirtualFolderId,
  toVirtualFolderId,
  fileBasename,
} from '../utils/workspaces';
import { getDirectoryColor, getDirectoryIcon } from '../utils/directoryIcons';
import DirectoryIconPicker from './DirectoryIconPicker';
import DirectoryColorPicker from './DirectoryColorPicker';
import './Sidebar.css';

interface SidebarProps {
  logDirectories: string[];
  activeDirectory: string;
  directoryMeta?: Record<string, DirectoryMeta>;
  virtualFolders?: VirtualFolder[];
  onDirectorySelect: (dir: string) => void;
  onAddDirectory: (dir: string) => void;
  onRemoveDirectory: (dir: string) => void;
  onRenameDirectory?: (dir: string, label: string) => void;
  onDirectoryMetaChange?: (meta: Record<string, DirectoryMeta>) => void;
  onReorderDirectories?: (dirs: string[]) => void;
  onCreateVirtualFolder?: () => void;
  onRenameVirtualFolder?: (id: string, name: string) => void;
  onDeleteVirtualFolder?: (id: string) => void;
  onUpdateVirtualFolder?: (id: string, patch: Partial<VirtualFolder>) => void;
  onAddFilesToVirtualFolder?: (id: string) => void;
  onRemoveFileFromVirtualFolder?: (id: string, filePath: string) => void;
  onLogFileSelect: (filePath: string | null) => void;
  onLogFilesSelect: (filePaths: string[], ctrlKey?: boolean) => void;
  onOpenFile?: () => void;
  currentFile: string | null;
  selectedFiles: string[];
  activeTabFiles?: string[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  includeSubdirectories?: boolean;
  editorOrder?: string[];
}

interface FileWithDate {
  name: string;
  path: string;
  date: string; // Format: YYYY-MM-DD
  dateObj: Date;
}

const Sidebar: React.FC<SidebarProps> = ({
  logDirectories,
  activeDirectory,
  directoryMeta = {},
  virtualFolders = [],
  onDirectorySelect,
  onAddDirectory,
  onRemoveDirectory,
  onRenameDirectory,
  onDirectoryMetaChange,
  onReorderDirectories,
  onCreateVirtualFolder,
  onRenameVirtualFolder,
  onDeleteVirtualFolder,
  onUpdateVirtualFolder,
  onAddFilesToVirtualFolder,
  onRemoveFileFromVirtualFolder,
  onLogFileSelect,
  onLogFilesSelect,
  onOpenFile,
  currentFile,
  activeTabFiles = [],
  isCollapsed = false,
  onToggleCollapse,
  includeSubdirectories = false,
  editorOrder,
}) => {
  const { t, language } = useTranslation();
  const [logFiles, setLogFiles] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);

  // Context menu for directory tabs
  const [dirContextMenu, setDirContextMenu] = useState<{ x: number; y: number; dir: string } | null>(null);
  const [virtualContextMenu, setVirtualContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<{ x: number; y: number; filePath: string } | null>(null);
  const [dirMenuPanel, setDirMenuPanel] = useState<'icon' | 'color' | null>(null);
  const [renamingDir, setRenamingDir] = useState<string | null>(null);
  const [renamingVirtualId, setRenamingVirtualId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverDir, setDragOverDir] = useState<string | null>(null);
  const dragSrcDir = React.useRef<string | null>(null);
  const loadRequestIdRef = useRef<string | null>(null);
  const dirContextMenuRef = useRef<HTMLDivElement>(null);
  const virtualContextMenuRef = useRef<HTMLDivElement>(null);
  const fileContextMenuRef = useRef<HTMLDivElement>(null);

  const activeVirtualId = fromVirtualFolderId(activeDirectory);
  const activeVirtualFolder = activeVirtualId
    ? virtualFolders.find((f) => f.id === activeVirtualId) ?? null
    : null;

  // Close context menus on outside click (ignore clicks inside the menu)
  useEffect(() => {
    if (!dirContextMenu && !fileContextMenu && !virtualContextMenu) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dirContextMenuRef.current?.contains(target)) return;
      if (virtualContextMenuRef.current?.contains(target)) return;
      if (fileContextMenuRef.current?.contains(target)) return;
      setDirContextMenu(null);
      setDirMenuPanel(null);
      setVirtualContextMenu(null);
      setFileContextMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dirContextMenu, fileContextMenu, virtualContextMenu]);


  const handleFileContextMenu = (e: React.MouseEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 200;
    const menuHeight = 88;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setFileContextMenu({ x, y, filePath });
    setDirContextMenu(null);
    setDirMenuPanel(null);
  };

  const openFileInExplorer = async (filePath: string) => {
    setFileContextMenu(null);
    try {
      await window.electronAPI?.showItemInFolder(filePath);
    } catch (error) {
      console.error('Failed to open file in Explorer:', error);
    }
  };

  const openFileInEditor = async (filePath: string) => {
    setFileContextMenu(null);
    try {
      await window.electronAPI?.openFileInEditor(filePath, 1, editorOrder);
    } catch (error) {
      console.error('Failed to open file in editor:', error);
    }
  };

  const handleDirContextMenu = (e: React.MouseEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuHeight = 180;
    // Place menu to the right of the tab strip; Y at cursor minus top padding so first item is under cursor
    const x = rect.right + 4;
    const rawY = e.clientY - 8;
    const y = Math.min(rawY, window.innerHeight - menuHeight - 8);
    setDirContextMenu({ x, y, dir });
    setDirMenuPanel(null);
    setVirtualContextMenu(null);
    setFileContextMenu(null);
  };

  const updateDirMeta = (dir: string, patch: Partial<DirectoryMeta>) => {
    if (!onDirectoryMetaChange) return;
    const current = directoryMeta[dir] ?? {};
    const next: DirectoryMeta = { ...current, ...patch };
    if (!next.label) delete next.label;
    if (!next.icon) delete next.icon;
    if (!next.color) delete next.color;
    const all = { ...directoryMeta };
    if (Object.keys(next).length === 0) {
      delete all[dir];
    } else {
      all[dir] = next;
    }
    onDirectoryMetaChange(all);
  };

  const startRename = (dir: string) => {
    setDirContextMenu(null);
    setDirMenuPanel(null);
    setRenamingDir(dir);
    setRenameValue(directoryMeta[dir]?.label ?? dirBasename(dir));
  };

  const commitRename = () => {
    if (renamingDir && onRenameDirectory) {
      onRenameDirectory(renamingDir, renameValue.trim());
    }
    if (renamingVirtualId && onRenameVirtualFolder) {
      onRenameVirtualFolder(renamingVirtualId, renameValue.trim());
    }
    setRenamingDir(null);
    setRenamingVirtualId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setRenamingDir(null);
      setRenamingVirtualId(null);
    }
  };

  const handleVirtualContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuHeight = 220;
    const x = rect.right + 4;
    const y = Math.min(e.clientY - 8, window.innerHeight - menuHeight - 8);
    setVirtualContextMenu({ x, y, id });
    setDirMenuPanel(null);
    setDirContextMenu(null);
    setFileContextMenu(null);
  };

  const updateVirtualMeta = (id: string, patch: { icon?: string; color?: string }) => {
    onUpdateVirtualFolder?.(id, patch);
  };

  const startVirtualRename = (id: string) => {
    const folder = virtualFolders.find((f) => f.id === id);
    setVirtualContextMenu(null);
    setDirMenuPanel(null);
    setRenamingVirtualId(id);
    setRenameValue(folder?.name ?? '');
  };

  const handleDragStart = (e: React.DragEvent, dir: string) => {
    dragSrcDir.current = dir;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-dir-tab', dir);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent, dir: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dir !== dragSrcDir.current) setDragOverDir(dir);
  };

  const handleDrop = (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDir(null);
    const src = dragSrcDir.current;
    if (!src || src === targetDir || !onReorderDirectories) return;
    const dirs = [...logDirectories];
    const srcIdx = dirs.indexOf(src);
    const tgtIdx = dirs.indexOf(targetDir);
    dirs.splice(srcIdx, 1);
    dirs.splice(tgtIdx, 0, src);
    onReorderDirectories(dirs);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    dragSrcDir.current = null;
    setDragOverDir(null);
  };

  // Extract date from filename (e.g. "2025-11-12.log" -> "2025-11-12")
  const extractDateFromFileName = (fileName: string): Date | null => {
    // Try to find various date formats in the filename
    // Format: YYYY-MM-DD or YYYY_MM_DD or YYYYMMDD
    const patterns = [
      /(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
      /(\d{4})_(\d{2})_(\d{2})/,  // YYYY_MM_DD
      /(\d{4})(\d{2})(\d{2})/,    // YYYYMMDD
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // Months are 0-based
        const day = parseInt(match[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    return null;
  };

  // Group files by date
  const groupedFiles = useMemo(() => {
    const filesWithDates: FileWithDate[] = logFiles.map((file) => {
      const dateFromName = extractDateFromFileName(file.name);
      // Use current date only for sorting purposes, but mark as 'no-date' for grouping
      const dateObj = dateFromName || new Date();

      let dateStr: string;
      if (dateFromName) {
        const year = dateFromName.getFullYear();
        const month = String(dateFromName.getMonth() + 1).padStart(2, '0');
        const day = String(dateFromName.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD in local time
      } else {
        dateStr = 'no-date';
      }

      return {
        ...file,
        date: dateStr,
        dateObj,
      };
    });

    // Sort by date (newest first)
    filesWithDates.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Group by date
    const groups = new Map<string, FileWithDate[]>();
    filesWithDates.forEach((file) => {
      if (!groups.has(file.date)) {
        groups.set(file.date, []);
      }
      groups.get(file.date)!.push(file);
    });

    // Convert to array and sort groups by date (newest first)
    return Array.from(groups.entries()).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [logFiles]);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    // Parse the date in local context
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const date = new Date(year, month, day);
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Set time to 0 for correct comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return t('sidebar.today');
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return t('sidebar.yesterday');
    } else {
      return date.toLocaleDateString(language, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  };

  useEffect(() => {
    if (!activeDirectory || !window.electronAPI) return;
    if (isVirtualFolderId(activeDirectory)) return;

    loadLogFiles();

    window.electronAPI.watchDirectory(activeDirectory);
    window.electronAPI.onDirectoryChanged(() => {
      loadLogFiles();
    });

    return () => {
      window.electronAPI.unwatchDirectory(activeDirectory);
      window.electronAPI.removeDirectoryChangedListener();
    };
  }, [activeDirectory, includeSubdirectories]);

  const activeVirtualFileKey = activeVirtualFolder
    ? `${activeVirtualFolder.id}:${activeVirtualFolder.filePaths.join('\0')}`
    : '';

  useEffect(() => {
    if (!activeDirectory || !isVirtualFolderId(activeDirectory)) return;
    const folder = virtualFolders.find((f) => f.id === fromVirtualFolderId(activeDirectory));
    setLoading(false);
    setLogFiles(
      (folder?.filePaths ?? []).map((path) => ({
        name: fileBasename(path),
        path,
      }))
    );
  }, [activeDirectory, activeVirtualFileKey]);

  const loadLogFiles = async () => {
    if (!window.electronAPI || !activeDirectory) return;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setLogFiles([]);

    try {
      if (
        window.electronAPI.listLogFilesStream &&
        window.electronAPI.onListLogFilesProgress &&
        window.electronAPI.removeListLogFilesProgressListener
      ) {
        window.electronAPI.removeListLogFilesProgressListener();

        window.electronAPI.onListLogFilesProgress((payload) => {
          if (payload.requestId !== loadRequestIdRef.current) return;

          if (payload.files && payload.files.length > 0) {
            setLogFiles((prev) => {
              const existing = new Set(prev.map((f) => f.path));
              const next = payload.files.filter((f) => !existing.has(f.path));
              return next.length > 0 ? [...prev, ...next] : prev;
            });
          }

          if (payload.done) {
            setLoading(false);
          }
        });

        const streamResult = await window.electronAPI.listLogFilesStream(
          activeDirectory,
          includeSubdirectories,
          requestId
        );

        if (!streamResult.success) {
          throw new Error(streamResult.error || 'Failed to start streamed listing');
        }

        return;
      }

      const result = await window.electronAPI.listLogFiles(activeDirectory, includeSubdirectories);
      if (result.success && result.files) {
        setLogFiles(result.files);
      }
    } catch (error) {
      console.error('Error loading log files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      window.electronAPI?.removeListLogFilesProgressListener?.();
    };
  }, []);

  const toggleGroup = (dateStr: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
      } else {
        newSet.add(dateStr);
      }
      return newSet;
    });
  };

  const toggleAllGroups = () => {
    if (collapsedGroups.size === groupedFiles.length) {
      // Alle sind collapsed, also alle aufklappen
      setCollapsedGroups(new Set());
    } else {
      // Alle zusammenklappen
      const allDates = groupedFiles.map(([dateStr]) => dateStr);
      setCollapsedGroups(new Set(allDates));
    }
  };

  const handleFileClick = (filePath: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Strg/Cmd gedrückt: Mehrfachauswahl
      // Sammle alle bereits ausgewählten Dateien (aus activeTabFiles) plus die neue
      const currentSelection = activeTabFiles.length > 0 ? [...activeTabFiles] : [];
      const newSelection = currentSelection.includes(filePath)
        ? currentSelection.filter(f => f !== filePath)
        : [...currentSelection, filePath];
      onLogFilesSelect(newSelection, true);
    } else {
      // Einfacher Klick: Einzelauswahl
      onLogFileSelect(filePath);
    }
  };

  const handleSelectDirectory = async () => {
    if (!window.electronAPI?.showOpenDirectoryDialog) return;
    setIsSelectingDirectory(true);
    try {
      const result = await window.electronAPI.showOpenDirectoryDialog();
      if (result.success && result.directoryPath) {
        onAddDirectory(result.directoryPath as string);
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  // Get folder basename for display in dir tabs
  const dirBasename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() || path;

  // Display label: custom label if set, otherwise basename
  const dirDisplayLabel = (dir: string) => directoryMeta[dir]?.label || dirBasename(dir);

  return (
    <>
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-inner">

        {/* ── Vertical directory tab strip (full height, left side) ── */}
        {!isCollapsed && (
          <div className="sidebar-dir-tabs">
            <div className="sidebar-dir-tabs-list">
            {logDirectories.map((dir) => {
              const meta = directoryMeta[dir];
              const colorHex = getDirectoryColor(meta?.color);
              const iconDef = getDirectoryIcon(meta?.icon);
              return (
              <button
                key={dir}
                className={`sidebar-dir-tab ${activeDirectory === dir ? 'active' : ''} ${dragOverDir === dir ? 'drag-over' : ''} ${colorHex ? 'has-color' : ''}`}
                title={dir}
                draggable
                style={
                  colorHex
                    ? ({
                        '--dir-tab-color': colorHex,
                      } as React.CSSProperties)
                    : undefined
                }
                onClick={() => onDirectorySelect(dir)}
                onContextMenu={(e) => handleDirContextMenu(e, dir)}
                onDragStart={(e) => handleDragStart(e, dir)}
                onDragOver={(e) => handleDragOver(e, dir)}
                onDrop={(e) => handleDrop(e, dir)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => setDragOverDir(null)}
              >
                {renamingDir === dir ? (
                  <input
                    className="sidebar-dir-tab-rename-input"
                    value={renameValue}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                  />
                ) : (
                  <span className="sidebar-dir-tab-label">{dirDisplayLabel(dir)}</span>
                )}
                {iconDef && (
                  <span className="sidebar-dir-tab-icon" aria-hidden>
                    <FontAwesomeIcon icon={iconDef} />
                  </span>
                )}
                <button
                  className="sidebar-dir-tab-close"
                  title={t('sidebar.removeDirectory')}
                  onClick={(e) => { e.stopPropagation(); onRemoveDirectory(dir); }}
                >×</button>
              </button>
              );
            })}
            {virtualFolders.map((folder) => {
              const tabId = toVirtualFolderId(folder.id);
              const colorHex = getDirectoryColor(folder.color);
              const iconDef = getDirectoryIcon(folder.icon) ?? getDirectoryIcon('bookmark');
              return (
                <button
                  key={tabId}
                  className={`sidebar-dir-tab sidebar-dir-tab-virtual ${activeDirectory === tabId ? 'active' : ''} ${colorHex ? 'has-color' : ''}`}
                  title={`${folder.name} (${folder.filePaths.length})`}
                  style={
                    colorHex
                      ? ({ '--dir-tab-color': colorHex } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => onDirectorySelect(tabId)}
                  onContextMenu={(e) => handleVirtualContextMenu(e, folder.id)}
                >
                  {renamingVirtualId === folder.id ? (
                    <input
                      className="sidebar-dir-tab-rename-input"
                      value={renameValue}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={handleRenameKeyDown}
                    />
                  ) : (
                    <span className="sidebar-dir-tab-label">{folder.name}</span>
                  )}
                  {iconDef && (
                    <span className="sidebar-dir-tab-icon" aria-hidden>
                      <FontAwesomeIcon icon={iconDef} />
                    </span>
                  )}
                  <button
                    className="sidebar-dir-tab-close"
                    title={t('virtualFolder.delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVirtualFolder?.(folder.id);
                    }}
                  >×</button>
                </button>
              );
            })}
            </div>
            {onCreateVirtualFolder && (
              <button
                type="button"
                className="sidebar-dir-tab-add"
                title={t('virtualFolder.create')}
                onClick={onCreateVirtualFolder}
              >
                +
              </button>
            )}
          </div>
        )}

        {/* ── Main area: header + file list ── */}
        <div className="sidebar-main">
          <div className="sidebar-header">
            {!isCollapsed && (
              <div className="sidebar-title">
                {activeVirtualFolder ? activeVirtualFolder.name : t('sidebar.files')}
              </div>
            )}
            <div className="sidebar-header-buttons">
              {!isCollapsed && activeVirtualFolder && (
                <button
                  onClick={() => onAddFilesToVirtualFolder?.(activeVirtualFolder.id)}
                  className="open-file-button"
                  title={t('virtualFolder.addFiles')}
                >
                  +
                </button>
              )}
              {!isCollapsed && !activeVirtualFolder && (
                <button
                  onClick={handleSelectDirectory}
                  className="open-folder-button"
                  title={t('sidebar.addDirectory')}
                  disabled={isSelectingDirectory}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              {!isCollapsed && (
                <button
                  onClick={onOpenFile}
                  className="open-file-button"
                  title={t('sidebar.openFile')}
                >
                  <img src="open-file.png" width="20" height="20" alt="" />
                </button>
              )}
              {!isCollapsed && groupedFiles.length > 0 && (
                <div className="sidebar-header-sep" />
              )}
              {!isCollapsed && groupedFiles.length > 0 && (
                <button
                  onClick={toggleAllGroups}
                  className="expand-all-button"
                  title={collapsedGroups.size === groupedFiles.length ? t('sidebar.expandAll') : t('sidebar.collapseAll')}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {collapsedGroups.size === groupedFiles.length ? (
                      <path d="M8 2L8 14M8 2L4 6M8 2L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    ) : (
                      <path d="M8 14L8 2M8 14L4 10M8 14L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    )}
                  </svg>
                </button>
              )}
              {!isCollapsed && (
                <button onClick={loadLogFiles} className="refresh-button" title={t('sidebar.refresh')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <button
                onClick={onToggleCollapse}
                className="collapse-sidebar-button"
                title={isCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
                aria-label={isCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isCollapsed ? (
                    <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="sidebar-content">
              {!activeDirectory ? (
                <div className="sidebar-empty">
                  <p>{t('sidebar.noDirectory')}</p>
                </div>
              ) : loading && logFiles.length === 0 ? (
                <div className="sidebar-loading">{t('sidebar.loading')}</div>
              ) : logFiles.length === 0 ? (
                <div className="sidebar-empty">
                  {activeVirtualFolder
                    ? t('virtualFolder.empty')
                    : t('sidebar.noFiles')}
                </div>
              ) : (
                <div className="log-file-groups">
                  {loading && <div className="sidebar-loading">{t('sidebar.loading')}</div>}
                  {groupedFiles.map(([dateStr, files]) => {
                    const isGroupCollapsed = collapsedGroups.has(dateStr);
                    const hasDate = dateStr !== 'no-date';
                    return (
                      <div key={dateStr} className="log-file-group">
                        {hasDate && (
                          <div
                            className="log-file-group-header"
                            onClick={() => toggleGroup(dateStr)}
                          >
                            <span className="log-file-group-toggle">
                              {isGroupCollapsed ? '▶' : '▼'}
                            </span>
                            <span className="log-file-group-title">
                              {formatDate(dateStr)}
                            </span>
                            {files.length > 1 && (
                              <button
                                className="log-file-group-open-all"
                                title={t('sidebar.openAll', { count: files.length })}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLogFilesSelect(files.map(f => f.path), e.ctrlKey);
                                }}
                              >
                                <img src="open-files-from-day.png" width="18" height="18" alt="" />
                              </button>
                            )}
                            <span className="log-file-group-count">({files.length})</span>
                          </div>
                        )}
                        {(!hasDate || !isGroupCollapsed) && (
                          <ul className="log-file-list">
                            {files.map((file) => {
                              const isActive = currentFile === file.path;
                              const isInActiveTab = activeTabFiles.includes(file.path);
                              return (
                                <li
                                  key={file.path}
                                  className={`log-file-item ${isActive ? 'active' : ''} ${isInActiveTab ? 'in-active-tab' : ''}`}
                                  onClick={(e) => handleFileClick(file.path, e)}
                                  onContextMenu={(e) => handleFileContextMenu(e, file.path)}
                                >
                                  {file.name}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>{/* end sidebar-main */}

      </div>{/* end sidebar-inner */}
    </div>

    {/* ── Directory tab context menu (portal to body, avoids backdrop-filter stacking context) ── */}
    {dirContextMenu && ReactDOM.createPortal(
      <div
        ref={dirContextMenuRef}
        className="sidebar-dir-context-menu"
        style={{ top: dirContextMenu.y, left: dirContextMenu.x }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="sidebar-dir-context-item"
          onClick={() => { onRemoveDirectory(dirContextMenu.dir); setDirContextMenu(null); setDirMenuPanel(null); }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('sidebar.closeFolder')}
        </button>
        <button
          className="sidebar-dir-context-item"
          onClick={() => startRename(dirContextMenu.dir)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('sidebar.renameFolder')}
        </button>
        <button
          className={`sidebar-dir-context-item ${dirMenuPanel === 'icon' ? 'active' : ''}`}
          onClick={() => setDirMenuPanel((p) => (p === 'icon' ? null : 'icon'))}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          {t('sidebar.setIcon')}
        </button>
        {dirMenuPanel === 'icon' && (
          <DirectoryIconPicker
            value={directoryMeta[dirContextMenu.dir]?.icon}
            clearLabel={t('sidebar.clearIcon')}
            searchPlaceholder={t('sidebar.searchIcons')}
            onChange={(iconId) => updateDirMeta(dirContextMenu.dir, { icon: iconId })}
          />
        )}
        <button
          className={`sidebar-dir-context-item ${dirMenuPanel === 'color' ? 'active' : ''}`}
          onClick={() => setDirMenuPanel((p) => (p === 'color' ? null : 'color'))}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
          </svg>
          {t('sidebar.setColor')}
        </button>
        {dirMenuPanel === 'color' && (
          <DirectoryColorPicker
            value={directoryMeta[dirContextMenu.dir]?.color}
            clearLabel={t('sidebar.clearColor')}
            onChange={(colorId) => updateDirMeta(dirContextMenu.dir, { color: colorId })}
          />
        )}
      </div>,
      document.body
    )}

    {/* ── File context menu ── */}
    {fileContextMenu && ReactDOM.createPortal(
      <div
        ref={fileContextMenuRef}
        className="sidebar-file-context-menu"
        style={{ top: fileContextMenu.y, left: fileContextMenu.x }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="sidebar-file-context-item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { void openFileInExplorer(fileContextMenu.filePath); }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4a1 1 0 011-1h4.586a1 1 0 01.707.293L8.707 4.707A1 1 0 009.414 5H14a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z" fill="currentColor"/>
          </svg>
          {t('sidebar.openInExplorer')}
        </button>
        <button
          type="button"
          className="sidebar-file-context-item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { void openFileInEditor(fileContextMenu.filePath); }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('sidebar.openInEditor')}
        </button>
        {activeVirtualFolder && (
          <button
            type="button"
            className="sidebar-file-context-item"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onRemoveFileFromVirtualFolder?.(activeVirtualFolder.id, fileContextMenu.filePath);
              setFileContextMenu(null);
            }}
          >
            {t('virtualFolder.removeFile')}
          </button>
        )}
      </div>,
      document.body
    )}

    {virtualContextMenu && ReactDOM.createPortal(
      <div
        ref={virtualContextMenuRef}
        className="sidebar-dir-context-menu"
        style={{ top: virtualContextMenu.y, left: virtualContextMenu.x }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="sidebar-dir-context-item"
          onClick={() => {
            onAddFilesToVirtualFolder?.(virtualContextMenu.id);
            setVirtualContextMenu(null);
            setDirMenuPanel(null);
          }}
        >
          {t('virtualFolder.addFiles')}
        </button>
        <button
          className="sidebar-dir-context-item"
          onClick={() => startVirtualRename(virtualContextMenu.id)}
        >
          {t('virtualFolder.rename')}
        </button>
        <button
          className={`sidebar-dir-context-item ${dirMenuPanel === 'icon' ? 'active' : ''}`}
          onClick={() => setDirMenuPanel((p) => (p === 'icon' ? null : 'icon'))}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          {t('sidebar.setIcon')}
        </button>
        {dirMenuPanel === 'icon' && (
          <DirectoryIconPicker
            value={virtualFolders.find((f) => f.id === virtualContextMenu.id)?.icon}
            clearLabel={t('sidebar.clearIcon')}
            searchPlaceholder={t('sidebar.searchIcons')}
            onChange={(iconId) => updateVirtualMeta(virtualContextMenu.id, { icon: iconId })}
          />
        )}
        <button
          className={`sidebar-dir-context-item ${dirMenuPanel === 'color' ? 'active' : ''}`}
          onClick={() => setDirMenuPanel((p) => (p === 'color' ? null : 'color'))}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
          </svg>
          {t('sidebar.setColor')}
        </button>
        {dirMenuPanel === 'color' && (
          <DirectoryColorPicker
            value={virtualFolders.find((f) => f.id === virtualContextMenu.id)?.color}
            clearLabel={t('sidebar.clearColor')}
            onChange={(colorId) => updateVirtualMeta(virtualContextMenu.id, { color: colorId })}
          />
        )}
        <button
          className="sidebar-dir-context-item"
          onClick={() => {
            onDeleteVirtualFolder?.(virtualContextMenu.id);
            setVirtualContextMenu(null);
            setDirMenuPanel(null);
          }}
        >
          {t('virtualFolder.delete')}
        </button>
      </div>,
      document.body
    )}
    </>
  );
};

export default Sidebar;
