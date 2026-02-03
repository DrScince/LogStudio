import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
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
  const scrollPositionRef = useRef<{ scrollOffset: number; scrollUpdateWasRequested: boolean }>({ scrollOffset: 0, scrollUpdateWasRequested: false });
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);

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
      // Reset loaded flag for new file
      hasLoadedRef.current = false;
      
      loadLogFile();
      
      if (window.electronAPI) {
        // Setup file watcher
        window.electronAPI.watchLogFile(filePath);
        
        // Define the change handler
        const handleFileChange = (changedPath: string) => {
          console.log('File changed:', changedPath, 'Current file:', filePath, 'Auto-refresh:', autoRefresh);
          if (changedPath === filePath) {
            loadLogFile();
          }
        };
        
        // Register the listener
        window.electronAPI.onLogFileChanged(handleFileChange);
      }
    }

    return () => {
      if (filePath && window.electronAPI) {
        window.electronAPI.unwatchLogFile(filePath);
        window.electronAPI.removeLogFileChangedListener();
      }
    };
  }, [filePath]);

  useEffect(() => {
    // Save current scroll position BEFORE any state change if tracking is off
    if (!autoScroll && listRef.current) {
      const currentState = listRef.current.state as any;
      const currentOffset = currentState.scrollOffset || scrollPositionRef.current.scrollOffset;
      if (currentOffset > 0) {
        pendingScrollRestoreRef.current = currentOffset;
        console.log('Saving scroll position before state change:', currentOffset);
      }
    }
    
    const filtered = filterLogEntries(logEntries, selectedLevels, selectedNamespaces, searchQuery);
    setFilteredEntries(filtered);
    console.log(`LogViewer: ${filtered.length} of ${logEntries.length} entries after filtering`);
  }, [logEntries, selectedLevels, selectedNamespaces, searchQuery, autoScroll]);

  const loadLogFile = async () => {
    if (!filePath || !window.electronAPI) return;

    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setLoading(true);
      console.log('Initial load - showing loading state');
    } else {
      console.log('Incremental update - NOT showing loading state');
    }
    
    try {
      const result = await window.electronAPI.readLogFile(filePath);
      if (result.success && result.content) {
        // Check if file has grown (new content added)
        const currentSize = result.content.length;
        const hasNewContent = currentSize > lastFileSizeRef.current;
        
        if (isInitialLoad) {
          // Initial load - parse everything
          const entries = parseLogFile(result.content, schema);
          console.log(`LogViewer: Initial load - ${entries.length} entries parsed`);
          setLogEntries(entries);
          lastFileSizeRef.current = currentSize;
          hasLoadedRef.current = true;
        } else if (hasNewContent) {
          // Incremental update - only parse new lines
          const previousContent = result.content.substring(0, lastFileSizeRef.current);
          const newContent = result.content.substring(lastFileSizeRef.current);
          
          // Count existing lines to get correct line numbers for new entries
          const existingLineCount = previousContent.split('\n').length - 1;
          
          // Parse only the new content
          const newEntries = parseLogFile(newContent, schema, existingLineCount);
          
          if (newEntries.length > 0) {
            console.log(`LogViewer: Appending ${newEntries.length} new entries`);
            
            // Save current scroll position if tracking is off
            if (!autoScroll && listRef.current) {
              const currentState = listRef.current.state as any;
              pendingScrollRestoreRef.current = currentState.scrollOffset || scrollPositionRef.current.scrollOffset;
            }
            
            // Append new entries without re-rendering existing ones
            setLogEntries(prevEntries => [...prevEntries, ...newEntries]);
          }
          
          lastFileSizeRef.current = currentSize;
        } else if (currentSize < lastFileSizeRef.current) {
          // File was truncated or replaced - reload everything
          console.log(`LogViewer: File truncated or replaced - reloading`);
          const entries = parseLogFile(result.content, schema);
          setLogEntries(entries);
          lastFileSizeRef.current = currentSize;
        }
      }
    } catch (error) {
      console.error('Error loading log file:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
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

  // Auto-Scroll bei neuen Einträgen nur wenn tracking aktiv ist
  const previousLengthRef = useRef(0);
  const isFirstRenderRef = useRef(true);
  
  // useLayoutEffect runs synchronously after DOM mutations but before browser paint
  // This prevents the visible "jump" to top
  useLayoutEffect(() => {
    // Skip first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousLengthRef.current = filteredEntries.length;
      return;
    }
    
    const hasNewEntries = filteredEntries.length > previousLengthRef.current;
    
    if (autoScroll && hasNewEntries) {
      // Scroll to end when new entries are added and tracking is on
      console.log('Auto-scrolling to end');
      scrollToEnd();
    } else if (!autoScroll) {
      // ALWAYS restore scroll position when tracking is off, on every render
      const positionToRestore = pendingScrollRestoreRef.current;
      console.log('Tracking OFF - Restoring scroll position:', positionToRestore);
      if (positionToRestore !== null && positionToRestore > 0 && listRef.current) {
        // Use requestAnimationFrame to ensure the list is fully rendered
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTo(positionToRestore);
            console.log('Scroll restored to:', positionToRestore);
          }
        });
      }
    }
    
    previousLengthRef.current = filteredEntries.length;
  }, [filteredEntries, autoScroll, scrollToEnd]);

  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
    scrollPositionRef.current = { scrollOffset, scrollUpdateWasRequested };
    // Also update pending restore ref if tracking is off
    if (!scrollUpdateWasRequested) {
      pendingScrollRestoreRef.current = scrollOffset;
    }
    console.log('Scroll event:', scrollOffset);
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

  const getItemSize = useCallback((index: number): number => {
    const entry = filteredEntries[index];
    if (!entry) return 30;

    const isExpanded = expandedLines.has(index);
    const baseHeight = 30; // Min-Höhe für eine Zeile
    
    if (isExpanded && entry.isMultiLine) {
      // Fixed height: 30px base + 400px for expanded content area
      return 430;
    }
    
    // Für sehr lange einzelne Nachrichten - zeige nur bei expansion
    if (isExpanded && entry.message.length > 150) {
      return 430;
    }
    
    return baseHeight;
  }, [filteredEntries, expandedLines]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Content copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, []);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              {expandedContent.type !== 'text' && (
                <div className="log-content-type-badge">
                  {expandedContent.type.toUpperCase()}
                </div>
              )}
              {(expandedContent.type === 'json' || expandedContent.type === 'xml' || expandedContent.type === 'exception') && (
                <button 
                  className="log-copy-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(expandedContent.formatted);
                  }}
                  title="Copy to clipboard"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4V2C4 1.44772 4.44772 1 5 1H13C13.5523 1 14 1.44772 14 2V10C14 10.5523 13.5523 11 13 11H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="2" y="5" width="9" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  Copy
                </button>
              )}
            </div>
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
            <label>Search:</label>
            <input
              type="text"
              className="search-input"
              placeholder="Enter search text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="log-viewer-stats">
          <span>{filteredEntries.length} / {logEntries.length} Entries</span>
          {selectedLevels.length > 0 && (
            <span className="filter-badge">Level: {selectedLevels.join(', ')}</span>
          )}
          {selectedNamespaces.length > 0 && (
            <span className="filter-badge">Namespace: {selectedNamespaces.length}</span>
          )}
          {searchQuery && (
            <span className="filter-badge">Search: "{searchQuery}"</span>
          )}
          {filteredEntries.length > 0 && (
            <>
              <button 
                onClick={() => setAutoScroll(!autoScroll)} 
                className={`auto-scroll-button ${autoScroll ? 'active' : ''}`}
                title={autoScroll ? "Disable auto-tracking" : "Enable auto-tracking"}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2V14M8 14L12 10M8 14L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                </svg>
                {autoScroll ? 'Tracking ON' : 'Tracking OFF'}
              </button>
              <button onClick={scrollToEnd} className="scroll-to-end-button" title="Jump to end">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12L8 4M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 14L13 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                End
              </button>
            </>
          )}
        </div>
      </div>
      <div className="log-viewer-content" ref={containerRef}>
        {loading ? (
          <div className="log-viewer-loading">Loading log file...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="log-viewer-empty">No entries found</div>
        ) : (
          <VariableSizeList
            ref={listRef}
            height={viewerHeight}
            itemCount={filteredEntries.length}
            itemSize={getItemSize}
            itemKey={(index) => filteredEntries[index]?.originalLineNumber ?? index}
            width="100%"
            estimatedItemSize={30}
            onScroll={handleScroll}
          >
            {Row}
          </VariableSizeList>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
