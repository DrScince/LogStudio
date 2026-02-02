import React, { useState, useEffect } from 'react';
import './Sidebar.css';

interface SidebarProps {
  logDirectory: string;
  onLogFileSelect: (filePath: string | null) => void;
  currentFile: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ logDirectory, onLogFileSelect, currentFile }) => {
  const [logFiles, setLogFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (logDirectory) {
      loadLogFiles();
    }
  }, [logDirectory]);

  const loadLogFiles = async () => {
    if (!window.electronAPI) return;
    
    setLoading(true);
    try {
      const result = await window.electronAPI.listLogFiles(logDirectory);
      if (result.success && result.files) {
        setLogFiles(result.files);
      }
    } catch (error) {
      console.error('Error loading log files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (filePath: string) => {
    onLogFileSelect(filePath);
  };

  if (!logDirectory) {
    return (
      <div className="sidebar">
        <div className="sidebar-empty">
          <p>Bitte wählen Sie ein Log-Verzeichnis in den Einstellungen aus.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Log-Dateien</h2>
        <button onClick={loadLogFiles} className="refresh-button" title="Aktualisieren">
          🔄
        </button>
      </div>
      <div className="sidebar-content">
        {loading ? (
          <div className="sidebar-loading">Lade...</div>
        ) : logFiles.length === 0 ? (
          <div className="sidebar-empty">Keine Log-Dateien gefunden</div>
        ) : (
          <ul className="log-file-list">
            {logFiles.map((file) => (
              <li
                key={file.path}
                className={`log-file-item ${currentFile === file.path ? 'active' : ''}`}
                onClick={() => handleFileClick(file.path)}
              >
                {file.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
