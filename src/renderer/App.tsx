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
            setSelectedNamespaces((prev) =>
              prev.includes(namespace) ? prev.filter((n) => n !== namespace) : [...prev, namespace]
            );
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
