import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LogViewer from './components/LogViewer';
import Sidebar from './components/Sidebar';
import NamespaceToolbar from './components/NamespaceToolbar';
import Toolbar from './components/Toolbar';
import { Tab } from './components/Toolbar';
import SettingsPanel from './components/SettingsPanel';
import AboutPanel from './components/AboutPanel';
import TitleBar from './components/TitleBar';
import { loadSettings, saveSettings, AppSettings } from './utils/settings';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [resetFilterTrigger, setResetFilterTrigger] = useState(0);

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
    if (!settings.logDirectory && window.electronAPI) {
      window.electronAPI.getDefaultLogDirectory().then((result) => {
        if (result.success && result.path) {
          setSettings((prev) => ({ ...prev, logDirectory: result.path || '' }));
        }
      });
    }
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
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

  const openFileInTab = useCallback((filePath: string) => {
    // Check if file is already open in a tab
    const existingTab = tabs.find((tab) => tab.filePath === filePath);
    
    if (existingTab) {
      // Switch to existing tab
      setActiveTabId(existingTab.id);
    } else {
      // Create a new tab
      const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newTab: Tab = {
        id: newTabId,
        filePath,
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

  const handleLogFilesSelect = useCallback((filePaths: string[]) => {
    if (filePaths.length > 0) {
      // Wenn bereits ein aktiver Tab existiert, füge die Dateien zu diesem Tab hinzu
      if (activeTabId) {
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
        // Kein aktiver Tab: Öffne alle ausgewählten Dateien in einem neuen Tab
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

  return (
    <div className="app">
      <TitleBar />
      <Toolbar
        onSettingsClick={() => setShowSettings(!showSettings)}
        onAboutClick={() => setShowAbout(!showAbout)}
        onOpenFile={handleOpenFile}
        onThemeToggle={handleThemeToggle}
        currentTheme={settings.theme}
        currentFile={currentLogFile}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
      />
      <div className="app-content">
        <Sidebar
          logDirectory={settings.logDirectory}
          onLogFileSelect={handleLogFileSelect}
          onLogFilesSelect={handleLogFilesSelect}
          currentFile={currentLogFile}
          selectedFiles={[]}
          activeTabFiles={activeTabFiles}
        />
        <LogViewer
          filePath={currentLogFile}
          filePaths={currentLogFiles}
          schema={settings.logSchema}
          autoRefresh={settings.autoRefresh}
          refreshInterval={settings.refreshInterval}
          selectedNamespaces={selectedNamespaces}
          onNamespacesChange={handleNamespacesChange}
          onResetFilters={handleResetFilters}
          key={`${activeTabId}-${resetFilterTrigger}`}
        />
        <NamespaceToolbar
          namespaces={namespaces}
          selectedNamespaces={selectedNamespaces}
          onNamespaceToggle={handleNamespaceToggle}
          isVisible={!!currentLogFile || (currentLogFiles && currentLogFiles.length > 0)}
        />
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
    </div>
  );
}

export default App;
