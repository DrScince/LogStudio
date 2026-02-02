import React, { useState, useEffect } from 'react';
import NamespaceTree from './NamespaceTree';
import './Sidebar.css';

interface SidebarProps {
  logDirectory: string;
  onLogFileSelect: (filePath: string | null) => void;
  currentFile: string | null;
  namespaces: string[];
  selectedNamespaces: string[];
  onNamespaceToggle: (namespace: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  logDirectory,
  onLogFileSelect,
  currentFile,
  namespaces,
  selectedNamespaces,
  onNamespaceToggle,
}) => {
  const [logFiles, setLogFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'namespaces'>('files');

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
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Dateien
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'namespaces' ? 'active' : ''}`}
            onClick={() => setActiveTab('namespaces')}
          >
            Namespaces
          </button>
        </div>
        {activeTab === 'files' && (
          <button onClick={loadLogFiles} className="refresh-button" title="Aktualisieren">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2.66667V5.33333M8 10.6667V13.3333M13.3333 8H10.6667M5.33333 8H2.66667M11.7267 4.27333L9.72667 6.27333M6.27333 9.72667L4.27333 11.7267M11.7267 11.7267L9.72667 9.72667M6.27333 6.27333L4.27333 4.27333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
      <div className="sidebar-content">
        {activeTab === 'files' ? (
          <>
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
          </>
        ) : (
          <NamespaceTree
            namespaces={namespaces}
            selectedNamespaces={selectedNamespaces}
            onNamespaceToggle={onNamespaceToggle}
          />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
