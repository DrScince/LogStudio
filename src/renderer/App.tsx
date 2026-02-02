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

  return (
    <div className="app">
      <Toolbar
        onSettingsClick={() => setShowSettings(!showSettings)}
        currentFile={currentLogFile}
      />
      <div className="app-content">
        <Sidebar
          logDirectory={settings.logDirectory}
          onLogFileSelect={setCurrentLogFile}
          currentFile={currentLogFile}
        />
        <LogViewer
          filePath={currentLogFile}
          schema={settings.logSchema}
          autoRefresh={settings.autoRefresh}
          refreshInterval={settings.refreshInterval}
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
