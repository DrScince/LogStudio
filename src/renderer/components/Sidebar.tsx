import React, { useState, useEffect, useMemo } from 'react';
import './Sidebar.css';

interface SidebarProps {
  logDirectory: string;
  onLogFileSelect: (filePath: string | null) => void;
  onLogFilesSelect: (filePaths: string[]) => void;
  currentFile: string | null;
  selectedFiles: string[];
  activeTabFiles?: string[]; // Dateien aus dem aktiven Tab (für Highlighting)
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  onLogFilesSelect,
  currentFile,
  selectedFiles,
  activeTabFiles = [],
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [logFiles, setLogFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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
      const date = dateFromName || new Date(); // Fallback to current date
      
      // Use local timezone instead of UTC
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD in local time
      
      return {
        ...file,
        date: dateStr,
        dateObj: date,
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
      return 'Today';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      // Format as "DD.MM.YYYY"
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
      onLogFilesSelect(newSelection);
    } else {
      // Einfacher Klick: Einzelauswahl
      onLogFileSelect(filePath);
    }
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && <div className="sidebar-title">Files</div>}
        <div className="sidebar-header-buttons">
          {!isCollapsed && groupedFiles.length > 0 && (
            <button 
              onClick={toggleAllGroups} 
              className="expand-all-button" 
              title={collapsedGroups.size === groupedFiles.length ? "Alle aufklappen" : "Alle zusammenklappen"}
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
          {!isCollapsed && <button onClick={loadLogFiles} className="refresh-button" title="Aktualisieren">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>}
          <button
            onClick={onToggleCollapse}
            className="collapse-sidebar-button"
            title={isCollapsed ? 'Dateileiste ausklappen' : 'Dateileiste einklappen'}
            aria-label={isCollapsed ? 'Expand file sidebar' : 'Collapse file sidebar'}
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
          {!logDirectory ? (
            <div className="sidebar-empty">
              <p>Please select a log directory in the settings.</p>
            </div>
          ) : loading ? (
            <div className="sidebar-loading">Lade...</div>
          ) : logFiles.length === 0 ? (
            <div className="sidebar-empty">No log files found</div>
          ) : (
            <div className="log-file-groups">
              {groupedFiles.map(([dateStr, files]) => {
                const isGroupCollapsed = collapsedGroups.has(dateStr);
                return (
                  <div key={dateStr} className="log-file-group">
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
                      <span className="log-file-group-count">({files.length})</span>
                    </div>
                    {!isGroupCollapsed && (
                      <ul className="log-file-list">
                        {files.map((file) => {
                          const isActive = currentFile === file.path;
                          const isInActiveTab = activeTabFiles.includes(file.path);
                          return (
                            <li
                              key={file.path}
                              className={`log-file-item ${isActive ? 'active' : ''} ${isInActiveTab ? 'in-active-tab' : ''}`}
                              onClick={(e) => handleFileClick(file.path, e)}
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
    </div>
  );
};

export default Sidebar;
