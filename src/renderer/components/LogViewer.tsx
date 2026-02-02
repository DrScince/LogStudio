import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import { LogEntry, LogLevel, LogSchema } from '../types/log';
import { parseLogFile, filterLogEntries, extractUniqueNamespaces, extractLogLevels } from '../utils/logParser';
import './LogViewer.css';

interface LogViewerProps {
  filePath: string | null;
  schema: LogSchema;
  autoRefresh: boolean;
  refreshInterval: number;
  selectedNamespaces: string[];
  onNamespacesChange: (namespaces: string[]) => void;
}

const LogViewer: React.FC<LogViewerProps> = ({
  filePath,
  schema,
  autoRefresh,
  refreshInterval,
  selectedNamespaces,
  onNamespacesChange,
}) => {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LogEntry[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const [viewerHeight, setViewerHeight] = useState(600);
  const listRef = useRef<FixedSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFileSizeRef = useRef<number>(0);

  const uniqueNamespaces = useMemo(() => extractUniqueNamespaces(logEntries), [logEntries]);
  const uniqueLevels = useMemo(() => extractLogLevels(logEntries), [logEntries]);

  // Aktualisiere Namespaces im Parent
  useEffect(() => {
    onNamespacesChange(uniqueNamespaces);
  }, [uniqueNamespaces, onNamespacesChange]);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewerHeight(rect.height);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    if (filePath) {
      loadLogFile();
      if (window.electronAPI) {
        window.electronAPI.watchLogFile(filePath);
        window.electronAPI.onLogFileChanged((changedPath) => {
          if (changedPath === filePath && autoRefresh) {
            loadLogFile();
          }
        });
      }
    }

    return () => {
      if (filePath && window.electronAPI) {
        window.electronAPI.unwatchLogFile(filePath);
        window.electronAPI.removeLogFileChangedListener();
      }
    };
  }, [filePath, autoRefresh]);

  useEffect(() => {
    const filtered = filterLogEntries(logEntries, selectedLevels, selectedNamespaces, searchQuery);
    setFilteredEntries(filtered);
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, [logEntries, selectedLevels, selectedNamespaces, searchQuery]);

  const loadLogFile = async () => {
    if (!filePath || !window.electronAPI) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.readLogFile(filePath);
      if (result.success && result.content) {
        const entries = parseLogFile(result.content, schema);
        setLogEntries(entries);
        lastFileSizeRef.current = result.content.length;
      }
    } catch (error) {
      console.error('Error loading log file:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const toggleNamespace = (namespace: string) => {
    setSelectedNamespaces((prev) =>
      prev.includes(namespace) ? prev.filter((n) => n !== namespace) : [...prev, namespace]
    );
  };

  const toggleExpand = useCallback((index: number) => {
    setExpandedLines((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'DEBUG':
        return '#569cd6';
      case 'INFO':
        return '#4ec9b0';
      case 'WARN':
        return '#dcdcaa';
      case 'ERROR':
        return '#f48771';
      case 'FATAL':
        return '#c586c0';
      default:
        return '#cccccc';
    }
  };

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = filteredEntries[index];
    if (!entry) return null;

    const isExpanded = expandedLines.has(index);
    const shouldShowExpand = entry.isMultiLine;

    return (
      <div style={style} className="log-entry">
        <div
          className={`log-entry-line ${entry.isMultiLine ? 'multiline' : ''}`}
          onClick={() => shouldShowExpand && toggleExpand(index)}
        >
          <span className="log-line-number">{entry.originalLineNumber}</span>
          <span className="log-timestamp">{entry.timestamp}</span>
          <span
            className="log-level"
            style={{ color: getLevelColor(entry.level) }}
          >
            {entry.level}
          </span>
          <span className="log-namespace">{entry.namespace}</span>
          <span className="log-message">
            {isExpanded || !entry.isMultiLine
              ? entry.message
              : entry.message.split('\n')[0] + ' ...'}
          </span>
          {shouldShowExpand && (
            <span className="log-expand-icon">{isExpanded ? '▼' : '▶'}</span>
          )}
        </div>
        {isExpanded && entry.isMultiLine && (
          <div className="log-entry-details">
            <pre className="log-full-text">{entry.fullText}</pre>
          </div>
        )}
      </div>
    );
  }, [filteredEntries, expandedLines, toggleExpand]);

  if (!filePath) {
    return (
      <div className="log-viewer">
        <div className="log-viewer-empty">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '16px', opacity: 0.5 }}>
              <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Keine Datei geöffnet</h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
              Bitte wählen Sie eine Log-Datei aus der Sidebar aus oder öffnen Sie eine Datei über den "Öffnen"-Button.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="log-viewer">
      <div className="log-viewer-toolbar">
        <div className="log-viewer-filters">
          <div className="filter-group">
            <label>Log-Level:</label>
            <div className="filter-buttons">
              {uniqueLevels.map((level) => (
                <button
                  key={level}
                  className={`filter-button ${selectedLevels.includes(level) ? 'active' : ''}`}
                  onClick={() => toggleLevel(level)}
                  style={{
                    borderColor: getLevelColor(level),
                    backgroundColor: selectedLevels.includes(level)
                      ? getLevelColor(level) + '33'
                      : 'transparent',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label>Suche:</label>
            <input
              type="text"
              className="search-input"
              placeholder="Suchtext eingeben..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="log-viewer-stats">
          {filteredEntries.length} / {logEntries.length} Einträge
        </div>
      </div>
      <div className="log-viewer-content" ref={containerRef}>
        {loading ? (
          <div className="log-viewer-loading">Lade Log-Datei...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="log-viewer-empty">Keine Einträge gefunden</div>
        ) : (
          <FixedSizeList
            ref={listRef}
            height={viewerHeight}
            itemCount={filteredEntries.length}
            itemSize={30}
            width="100%"
          >
            {Row}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
