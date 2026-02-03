import React, { useState, useEffect, useCallback } from 'react';
import LogViewer from './components/LogViewer';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import TabBar, { Tab } from './components/TabBar';
import SettingsPanel from './components/SettingsPanel';
import TitleBar from './components/TitleBar';
import { loadSettings, saveSettings, AppSettings } from './utils/settings';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [resetFilterTrigger, setResetFilterTrigger] = useState(0);

  // Aktiver Tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const currentLogFile = activeTab?.filePath || null;
  const selectedNamespaces = activeTab?.selectedNamespaces || [];
  const namespaces = activeTab?.namespaces || [];

  useEffect(() => {
    // Setze Standard-Log-Verzeichnis, falls nicht gesetzt
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

  const handleOpenFile = async () => {
    try {
      if (!window.electronAPI) {
        console.error('electronAPI is not available');
        alert('Fehler: Electron API ist nicht verfügbar. Bitte starten Sie die Anwendung neu.');
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
        alert(`Fehler beim Öffnen der Datei: ${result.error || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      console.error('Exception in handleOpenFile:', error);
      alert(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  const openFileInTab = useCallback((filePath: string) => {
    // Prüfe, ob die Datei bereits in einem Tab geöffnet ist
    const existingTab = tabs.find((tab) => tab.filePath === filePath);
    
    if (existingTab) {
      // Wechsle zum existierenden Tab
      setActiveTabId(existingTab.id);
    } else {
      // Erstelle einen neuen Tab
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

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);
      
      // Wenn der geschlossene Tab der aktive war, wechsle zum nächsten Tab
      if (tabId === activeTabId) {
        if (newTabs.length > 0) {
          // Wechsle zum letzten Tab oder zum ersten, wenn es der letzte war
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

  const handleNamespaceToggle = useCallback((namespace: string) => {
    if (!activeTabId) return;
    
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        
        const isCurrentlySelected = tab.selectedNamespaces.includes(namespace);
        
        if (isCurrentlySelected) {
          // Namespace abwählen
          return {
            ...tab,
            selectedNamespaces: tab.selectedNamespaces.filter((n) => n !== namespace),
          };
        } else {
          // Namespace auswählen - entferne übergeordnete und untergeordnete Namespaces
          let newSelection = [...tab.selectedNamespaces];
          
          // Entferne alle übergeordneten Namespaces
          newSelection = newSelection.filter((selected) => {
            return !namespace.startsWith(selected + '.');
          });
          
          // Entferne alle untergeordneten Namespaces
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
    
    // Setze Namespace-Filter zurück
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, selectedNamespaces: [] } : tab
      )
    );
    
    // Triggere Reset im LogViewer
    setResetFilterTrigger(prev => prev + 1);
  }, [activeTabId]);

  return (
    <div className="app">
      <TitleBar />
      <Toolbar
        onSettingsClick={() => setShowSettings(!showSettings)}
        onOpenFile={handleOpenFile}
        onResetFilters={handleResetFilters}
        currentFile={currentLogFile}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
      />
      <div className="app-content">
        <Sidebar
          logDirectory={settings.logDirectory}
          onLogFileSelect={handleLogFileSelect}
          currentFile={currentLogFile}
          namespaces={namespaces}
          selectedNamespaces={selectedNamespaces}
          onNamespaceToggle={handleNamespaceToggle}
        />
        <LogViewer
          filePath={currentLogFile}
          schema={settings.logSchema}
          autoRefresh={settings.autoRefresh}
          refreshInterval={settings.refreshInterval}
          selectedNamespaces={selectedNamespaces}
          onNamespacesChange={handleNamespacesChange}
          key={`${activeTabId}-${resetFilterTrigger}`}
        />
      </div>
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
