import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import LogViewer from './components/LogViewer';
import XmlViewer from './components/XmlViewer';
import JsonViewer from './components/JsonViewer';
import { detectLogFormat } from './utils/logFormatDetector';
import Sidebar from './components/Sidebar';
import NamespaceToolbar from './components/NamespaceToolbar';
import Toolbar from './components/Toolbar';
import { Tab } from './components/Toolbar';
import SettingsPanel from './components/SettingsPanel';
import AboutPanel from './components/AboutPanel';
import TitleBar from './components/TitleBar';
import Toast from './components/Toast';
import { loadSettings, saveSettings, AppSettings } from './utils/settings';
import { I18nProvider, useTranslation } from './i18n';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [resetFilterTrigger, setResetFilterTrigger] = useState(0);
  const [isFileSidebarCollapsed, setIsFileSidebarCollapsed] = useState(false);
  const [activeDirectory, setActiveDirectory] = useState<string>(
    () => settings.logDirectories[0] ?? ''
  );
  const [dirLabels, setDirLabels] = useState<Record<string, string>>({});

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

  const ALLOWED_EXTENSIONS = ['.log', '.txt', '.xml', '.json'];

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

  useEffect(() => {
    // Set default log directory if not set
    if (settings.logDirectories.length === 0 && window.electronAPI) {
      window.electronAPI.getDefaultLogDirectory().then((result) => {
        if (result.success && result.path) {
          const defaultPath = result.path || '';
          setSettings((prev) => ({
            ...prev,
            logDirectory: defaultPath,
            logDirectories: [defaultPath],
          }));
          setActiveDirectory(defaultPath);
        }
      });
    }
  }, []);

  // Keep activeDirectory valid when logDirectories changes
  useEffect(() => {
    if (settings.logDirectories.length === 0) {
      setActiveDirectory('');
    } else if (!settings.logDirectories.includes(activeDirectory)) {
      setActiveDirectory(settings.logDirectories[0]);
    }
  }, [settings.logDirectories]);

  // Track active file: switch folder tab to the directory containing the active file
  useEffect(() => {
    const filePath = currentLogFile ?? (currentLogFiles && currentLogFiles[0]);
    if (!filePath) return;
    // Normalize separators
    const normalized = filePath.replace(/\\/g, '/');
    const match = settings.logDirectories.find((dir) => {
      const normDir = dir.replace(/\\/g, '/').replace(/\/$/, '');
      return normalized.startsWith(normDir + '/');
    });
    if (match && match !== activeDirectory) {
      setActiveDirectory(match);
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

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  const handleAddDirectory = (newPath: string) => {
    setSettings((prev) => {
      const dirs = prev.logDirectories ?? [];
      if (dirs.includes(newPath)) {
        setActiveDirectory(newPath);
        return prev;
      }
      return { ...prev, logDirectories: [...dirs, newPath] };
    });
    setActiveDirectory(newPath);
  };

  const handleRemoveDirectory = (dir: string) => {
    setSettings((prev) => ({
      ...prev,
      logDirectories: prev.logDirectories.filter((d) => d !== dir),
    }));
    setDirLabels((prev) => {
      const next = { ...prev };
      delete next[dir];
      return next;
    });
  };

  const handleRenameDirectory = (dir: string, label: string) => {
    setDirLabels((prev) => ({ ...prev, [dir]: label }));
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

  const openFileInTab = useCallback(async (filePath: string) => {
    // Check if file is already open in a single-file tab (not a group tab)
    const existingTab = tabs.find((tab) => 
      tab.filePath === filePath && 
      (!tab.filePaths || tab.filePaths.length <= 1)
    );
    
    if (existingTab) {
      // Switch to existing tab
      setActiveTabId(existingTab.id);
    } else {
      // Create a new tab — detect type by extension first, then by content
      const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const lp = filePath.toLowerCase();
      let isXml = lp.endsWith('.xml');
      let isJson = false;

      // For JSON files and unknown extensions: peek at content to decide viewer
      const needsContentCheck = lp.endsWith('.json') || (!isXml && !lp.endsWith('.log') && !lp.endsWith('.txt'));
      if (needsContentCheck && window.electronAPI) {
        try {
          const result = await window.electronAPI.readLogFile(filePath);
          if (result.success && result.content) {
            const trimmed = result.content.trimStart();
            if (!isXml && (trimmed.startsWith('<?xml') || /^<[A-Za-z][A-Za-z0-9\-_]*[\s>]/.test(trimmed))) {
              isXml = true;
            } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              // JSON: check if it looks like a log (has timestamp/level/message keys)
              const fmt = detectLogFormat(result.content);
              const isJsonLog = fmt.name === 'json-ecs' || fmt.name === 'json-multiline';
              isJson = !isJsonLog;
            }
          }
        } catch {
          // ignore — fall through to log viewer
        }
      }

      const newTab: Tab = {
        id: newTabId,
        filePath,
        isXml,
        isJson,
        selectedNamespaces: [],
        namespaces: [],
      };
      
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTabId);
    }
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

  const handleNamespacesChange = useCallback((newNamespaces: string[]) => {
    if (!activeTabId) return;
    
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, namespaces: newNamespaces } : tab
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

  const handleDroppedPaths = useCallback((paths: string[]) => {
    setIsDragOver(false);

    const invalid = paths.filter(
      (p) => !ALLOWED_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext))
    );

    if (invalid.length > 0) {
      const names = invalid.map((p) => p.split(/[\\/]/).pop() ?? p).join(', ');
      setDragError(
        invalid.length === paths.length
          ? `Datei${invalid.length > 1 ? 'en' : ''} nicht unterstützt: ${names}\nErlaubte Formate: ${ALLOWED_EXTENSIONS.join(', ')}`
          : `Folgende Dateien werden nicht unterstützt: ${names}\nErlaubte Formate: ${ALLOWED_EXTENSIONS.join(', ')}`
      );
    }

    const valid = paths.filter((p) =>
      ALLOWED_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext))
    );

    if (valid.length === 1) {
      openFileInTab(valid[0]);
    } else if (valid.length > 1) {
      openMultipleFilesInTab(valid);
    }
  }, [openFileInTab, openMultipleFilesInTab, ALLOWED_EXTENSIONS]);

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
            <span className="drag-overlay-hint">{ALLOWED_EXTENSIONS.join(', ')}</span>
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
      />
      <Toolbar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onCloseAll={() => {
          setTabs([]);
          setActiveTabId(null);
        }}
        onCloseOthers={(tabId) => {
          setTabs((prev) => prev.filter((t) => t.id === tabId));
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
          dirLabels={dirLabels}
          onDirectorySelect={setActiveDirectory}
          onAddDirectory={handleAddDirectory}
          onRemoveDirectory={handleRemoveDirectory}
          onRenameDirectory={handleRenameDirectory}
          onReorderDirectories={(dirs) => setSettings((prev) => ({ ...prev, logDirectories: dirs }))}
          onLogFileSelect={handleLogFileSelect}
          onLogFilesSelect={handleLogFilesSelect}
          onOpenFile={handleOpenFile}
          currentFile={currentLogFile}
          selectedFiles={[]}
          activeTabFiles={activeTabFiles}
          isCollapsed={isFileSidebarCollapsed}
          onToggleCollapse={() => setIsFileSidebarCollapsed((prev) => !prev)}
          includeSubdirectories={settings.includeSubdirectories}
        />
        {activeTab?.isXml ? (
          <XmlViewer
            filePath={activeTab.filePath}
            key={activeTabId ?? ''}
          />
        ) : activeTab?.isJson ? (
          <JsonViewer
            filePath={activeTab.filePath}
            hotkeys={settings.hotkeys}
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
              key={`${activeTabId}-${resetFilterTrigger}`}
            />
            <NamespaceToolbar
              namespaces={namespaces}
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
          dirLabels={dirLabels}
          onDirLabelsChange={setDirLabels}
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
