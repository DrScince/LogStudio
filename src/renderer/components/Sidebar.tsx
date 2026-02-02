import React, { useState, useEffect, useMemo } from 'react';
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

interface FileWithDate {
  name: string;
  path: string;
  date: string; // Format: YYYY-MM-DD
  dateObj: Date;
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

  // Extrahiere Datum aus Dateinamen (z.B. "2025-11-12.log" -> "2025-11-12")
  const extractDateFromFileName = (fileName: string): Date | null => {
    // Versuche verschiedene Datumsformate im Dateinamen zu finden
    // Format: YYYY-MM-DD oder YYYY_MM_DD oder YYYYMMDD
    const patterns = [
      /(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
      /(\d{4})_(\d{2})_(\d{2})/,  // YYYY_MM_DD
      /(\d{4})(\d{2})(\d{2})/,    // YYYYMMDD
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // Monate sind 0-basiert
        const day = parseInt(match[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    return null;
  };

  // Gruppiere Dateien nach Datum
  const groupedFiles = useMemo(() => {
    const filesWithDates: FileWithDate[] = logFiles.map((file) => {
      const dateFromName = extractDateFromFileName(file.name);
      const date = dateFromName || new Date(); // Fallback auf aktuelles Datum
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      return {
        ...file,
        date: dateStr,
        dateObj: date,
      };
    });

    // Sortiere nach Datum (neueste zuerst)
    filesWithDates.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Gruppiere nach Datum
    const groups = new Map<string, FileWithDate[]>();
    filesWithDates.forEach((file) => {
      if (!groups.has(file.date)) {
        groups.set(file.date, []);
      }
      groups.get(file.date)!.push(file);
    });

    // Konvertiere zu Array und sortiere Gruppen nach Datum (neueste zuerst)
    return Array.from(groups.entries()).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [logFiles]);

  // Formatiere Datum für Anzeige
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Setze Zeit auf 0 für Vergleich
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Heute';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Gestern';
    } else {
      // Formatiere als "DD.MM.YYYY"
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  };

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
              <div className="log-file-groups">
                {groupedFiles.map(([dateStr, files]) => (
                  <div key={dateStr} className="log-file-group">
                    <div className="log-file-group-header">
                      {formatDate(dateStr)}
                      <span className="log-file-group-count">({files.length})</span>
                    </div>
                    <ul className="log-file-list">
                      {files.map((file) => (
                        <li
                          key={file.path}
                          className={`log-file-item ${currentFile === file.path ? 'active' : ''}`}
                          onClick={() => handleFileClick(file.path)}
                        >
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
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
