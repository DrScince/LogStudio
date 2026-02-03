import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { VariableSizeList } from 'react-window';
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
  onResetFilters?: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({
  filePath,
  schema,
  autoRefresh,
  refreshInterval,
  selectedNamespaces,
  onNamespacesChange,
  onResetFilters,
}) => {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LogEntry[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const [viewerHeight, setViewerHeight] = useState(600);
  const [autoScroll, setAutoScroll] = useState(false);
  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFileSizeRef = useRef<number>(0);

  // JSON/XML Formatting
  const formatJSON = (text: string): { formatted: string; isValid: boolean } => {
    try {
      // Trim the text first
      const trimmed = text.trim();
      
      // Check if text starts/ends with JSON characters
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        const parsed = JSON.parse(trimmed);
        const formatted = JSON.stringify(parsed, null, 2);
        return { formatted, isValid: true };
      }
      
      // Search for JSON within the text
      // Try object first
      let jsonMatch = text.match(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/s);
      if (!jsonMatch) {
        // Then array - with improved regex
        jsonMatch = text.match(/\[[\s\S]*?\]/);
      }
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const formatted = JSON.stringify(parsed, null, 2);
          return { formatted, isValid: true };
        } catch {
          // Try the entire text
          const parsed = JSON.parse(text);
          const formatted = JSON.stringify(parsed, null, 2);
          return { formatted, isValid: true };
        }
      }
    } catch (e) {
      // Not valid JSON
    }
    return { formatted: text, isValid: false };
  };

  const formatXML = (text: string): { formatted: string; isValid: boolean } => {
    try {
      // Check if XML-like content is present
      if (text.includes('<') && text.includes('>')) {
        const xmlMatch = text.match(/<[\s\S]*>/);
        if (xmlMatch) {
          let formatted = xmlMatch[0];
          // Simple XML formatting
          formatted = formatted.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
          const pad = (level: number) => '  '.repeat(level);
          let level = 0;
          formatted = formatted.split('\n').map(line => {
            if (line.match(/^<\/\w/)) level--;
            const padded = pad(level) + line;
            if (line.match(/^<\w[^>]*[^\/]>.*$/)) level++;
            return padded;
          }).join('\n');
          return { formatted, isValid: true };
        }
      }
    } catch (e) {
      // Not valid XML
    }
    return { formatted: text, isValid: false };
  };

  const formatException = (text: string): { formatted: string; isValid: boolean } => {
    // Search for exception patterns
    const exceptionPatterns = [
      /(?:Exception|Error)\s*:\s*(.+?)(?=\n|$)/gi,
      /at\s+[\w.<>$]+\([^)]*\)/gi,
      /\s+at\s+.+?\(.+?:\d+\)/gi,
      /Caused by:\s*.+/gi,
    ];

    let hasException = false;
    for (const pattern of exceptionPatterns) {
      if (pattern.test(text)) {
        hasException = true;
        break;
      }
    }

    if (!hasException) {
      return { formatted: text, isValid: false };
    }

    // Formatiere den Text für bessere Lesbarkeit
    let formatted = text;

    // Hebe Exception-Zeilen hervor
    formatted = formatted.replace(
      /(\w+(?:Exception|Error))\s*:\s*(.+)/gi,
      '<span class="exception-type">$1</span>: <span class="exception-message">$2</span>'
    );

    // Formatiere Stack Trace-Zeilen
    formatted = formatted.replace(
      /^(\s*at\s+)([\w.<>$]+)\(([^)]*)\)/gim,
      '$1<span class="stack-method">$2</span>(<span class="stack-location">$3</span>)'
    );

    // Formatiere "Caused by" Zeilen
    formatted = formatted.replace(
      /(Caused by:\s*)(.+)/gi,
      '<span class="exception-caused">$1</span><span class="exception-type">$2</span>'
    );

    return { formatted, isValid: true };
  };

  const analyzeAndFormatContent = (text: string): { formatted: string; type: 'json' | 'xml' | 'exception' | 'text'; isHtml?: boolean } => {
    // Check for exception first
    const exceptionResult = formatException(text);
    if (exceptionResult.isValid) {
      return { formatted: exceptionResult.formatted, type: 'exception', isHtml: true };
    }

    // Check for JSON first
    const jsonResult = formatJSON(text);
    if (jsonResult.isValid) {
      return { formatted: jsonResult.formatted, type: 'json' };
    }

    // Then check for XML
    const xmlResult = formatXML(text);
    if (xmlResult.isValid) {
      return { formatted: xmlResult.formatted, type: 'xml' };
    }

    // Otherwise plain text
    return { formatted: text, type: 'text' };
  };

  const uniqueNamespaces = useMemo(() => extractUniqueNamespaces(logEntries), [logEntries]);
  const uniqueLevels = useMemo(() => extractLogLevels(logEntries), [logEntries]);

  // Update namespaces in parent
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
    console.log(`LogViewer: ${filtered.length} of ${logEntries.length} entries after filtering`);
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
        console.log(`LogViewer: ${entries.length} Einträge aus Datei geparst`);
        console.log(`LogViewer: Einträge nach Level:`, entries.reduce((acc, e) => {
          acc[e.level] = (acc[e.level] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
        
        // Zeige erste paar Einträge zur Debugging
        if (entries.length > 0) {
          console.log('LogViewer: Erste 3 Einträge:', entries.slice(0, 3).map(e => ({
            line: e.originalLineNumber,
            timestamp: e.timestamp,
            level: e.level,
            namespace: e.namespace,
            message: e.message.substring(0, 50),
          })));
        }
        
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
    // Reset cache für dynamische Höhenberechnung
    if (listRef.current) {
      listRef.current.resetAfterIndex(index);
    }
  }, []);

  const scrollToEnd = useCallback(() => {
    if (listRef.current && filteredEntries.length > 0) {
      listRef.current.scrollToItem(filteredEntries.length - 1, 'end');
    }
  }, [filteredEntries]);

  // Auto-Scroll bei neuen Einträgen
  useEffect(() => {
    if (autoScroll && filteredEntries.length > 0) {
      scrollToEnd();
    }
  }, [filteredEntries.length, autoScroll, scrollToEnd]);

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

  const getItemSize = useCallback((index: number): number => {
    const entry = filteredEntries[index];
    if (!entry) return 30;

    const isExpanded = expandedLines.has(index);
    const baseHeight = 30; // Min-Höhe für eine Zeile
    
    if (isExpanded && entry.isMultiLine) {
      // Berechne Höhe basierend auf Textinhalt
      const lines = entry.fullText.split('\n').length;
      const expandedHeight = Math.max(200, Math.min(lines * 22 + 100, 850)); // Min 200px, Max 850px
      return baseHeight + expandedHeight + 1; // +1 für Border
    }
    
    // Für sehr lange einzelne Nachrichten - zeige nur bei expansion
    if (isExpanded && entry.message.length > 150) {
      const estimatedLines = Math.ceil(entry.message.length / 100);
      const expandedHeight = Math.max(200, Math.min(estimatedLines * 22 + 80, 750));
      return baseHeight + expandedHeight;
    }
    
    return baseHeight;
  }, [filteredEntries, expandedLines]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = filteredEntries[index];
    if (!entry) return null;

    const isExpanded = expandedLines.has(index);
    const isLongMessage = entry.message.length > 150;
    const shouldShowExpand = entry.isMultiLine || isLongMessage;

    // Analysiere und formatiere den Inhalt wenn expandiert
    const expandedContent = isExpanded ? analyzeAndFormatContent(entry.isMultiLine ? entry.fullText : entry.message) : null;

    return (
      <div style={style} className="log-entry">
        <div
          className={`log-entry-line ${shouldShowExpand ? 'multiline' : ''}`}
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
            {isExpanded
              ? entry.message
              : entry.isMultiLine
              ? entry.message.split('\n')[0] + ' ...'
              : isLongMessage
              ? entry.message.substring(0, 150) + ' ...'
              : entry.message}
          </span>
          {shouldShowExpand && (
            <span className="log-expand-icon">{isExpanded ? '▼' : '▶'}</span>
          )}
        </div>
        {isExpanded && expandedContent && (
          <div className="log-entry-details">
            {expandedContent.type !== 'text' && (
              <div className="log-content-type-badge">
                {expandedContent.type.toUpperCase()}
              </div>
            )}
            {expandedContent.isHtml ? (
              <pre 
                className={`log-full-text log-content-${expandedContent.type}`}
                dangerouslySetInnerHTML={{ __html: expandedContent.formatted }}
              />
            ) : (
              <pre className={`log-full-text log-content-${expandedContent.type}`}>
                {expandedContent.formatted}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }, [filteredEntries, expandedLines, toggleExpand, analyzeAndFormatContent]);

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
              Please select a log file from the sidebar or open a file using the "Open" button.
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
          <span>{filteredEntries.length} / {logEntries.length} Einträge</span>
          {selectedLevels.length > 0 && (
            <span className="filter-badge">Level: {selectedLevels.join(', ')}</span>
          )}
          {selectedNamespaces.length > 0 && (
            <span className="filter-badge">Namespace: {selectedNamespaces.length}</span>
          )}
          {searchQuery && (
            <span className="filter-badge">Suche: "{searchQuery}"</span>
          )}
          {filteredEntries.length > 0 && (
            <>
              <button 
                onClick={() => setAutoScroll(!autoScroll)} 
                className={`auto-scroll-button ${autoScroll ? 'active' : ''}`}
                title={autoScroll ? "Auto-Tracking deaktivieren" : "Auto-Tracking aktivieren"}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2V14M8 14L12 10M8 14L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                </svg>
                {autoScroll ? 'Tracking AN' : 'Tracking AUS'}
              </button>
              <button onClick={scrollToEnd} className="scroll-to-end-button" title="Zum Ende springen">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12L8 4M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 14L13 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Ende
              </button>
            </>
          )}
        </div>
      </div>
      <div className="log-viewer-content" ref={containerRef}>
        {loading ? (
          <div className="log-viewer-loading">Lade Log-Datei...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="log-viewer-empty">Keine Einträge gefunden</div>
        ) : (
          <VariableSizeList
            ref={listRef}
            height={viewerHeight}
            itemCount={filteredEntries.length}
            itemSize={getItemSize}
            width="100%"
            estimatedItemSize={30}
          >
            {Row}
          </VariableSizeList>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
