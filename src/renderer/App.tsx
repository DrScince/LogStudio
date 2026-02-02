import React, { useState, useEffect } from 'react';
import LogViewer from './components/LogViewer';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import SettingsPanel from './components/SettingsPanel';
import { loadSettings, saveSettings, AppSettings } from './utils/settings';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [currentLogFile, setCurrentLogFile] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);

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
        setCurrentLogFile(result.filePath);
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

  return (
    <div className="app">
      <Toolbar
        onSettingsClick={() => setShowSettings(!showSettings)}
        onOpenFile={handleOpenFile}
        currentFile={currentLogFile}
      />
      <div className="app-content">
        <Sidebar
          logDirectory={settings.logDirectory}
          onLogFileSelect={setCurrentLogFile}
          currentFile={currentLogFile}
          namespaces={namespaces}
          selectedNamespaces={selectedNamespaces}
          onNamespaceToggle={(namespace) => {
            setSelectedNamespaces((prev) => {
              const isCurrentlySelected = prev.includes(namespace);
              
              if (isCurrentlySelected) {
                // Namespace abwählen - einfach entfernen
                return prev.filter((n) => n !== namespace);
              } else {
                // Namespace auswählen - entferne übergeordnete und untergeordnete Namespaces
                let newSelection = [...prev];
                
                // Entferne alle übergeordneten Namespaces (z.B. wenn "iACF.Core" ausgewählt wird, entferne "iACF")
                newSelection = newSelection.filter((selected) => {
                  // Wenn der ausgewählte Namespace ein Kind des zu toggle-enden Namespaces ist, behalte ihn nicht
                  return !namespace.startsWith(selected + '.');
                });
                
                // Entferne alle untergeordneten Namespaces (z.B. wenn "iACF" ausgewählt wird, entferne "iACF.Core", "iACF.Infrastructure", etc.)
                newSelection = newSelection.filter((selected) => {
                  // Wenn der ausgewählte Namespace ein Elternteil des zu toggle-enden Namespaces ist, behalte ihn nicht
                  return !selected.startsWith(namespace + '.');
                });
                
                // Füge den neuen Namespace hinzu
                return [...newSelection, namespace];
              }
            });
          }}
        />
        <LogViewer
          filePath={currentLogFile}
          schema={settings.logSchema}
          autoRefresh={settings.autoRefresh}
          refreshInterval={settings.refreshInterval}
          selectedNamespaces={selectedNamespaces}
          onNamespacesChange={setNamespaces}
        />
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
