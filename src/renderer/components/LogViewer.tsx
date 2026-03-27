import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { VariableSizeList } from 'react-window';
import { LogEntry, LogLevel, LogSchema } from '../types/log';
import { parseLogFile, filterLogEntries, extractUniqueNamespaces, extractLogLevels } from '../utils/logParser';
import { useTranslation } from '../i18n';
import Toast from './Toast';
import './LogViewer.css';

interface LogViewerProps {
  filePath: string | null;
  filePaths?: string[] | null; // Für mehrere Dateien
  schema: LogSchema;
  autoRefresh: boolean;
  refreshInterval: number;
  selectedNamespaces: string[];
  onNamespacesChange: (namespaces: string[]) => void;
  onResetFilters?: () => void;
  editorOrder?: string[];
}

type ResizableColumn = 'timestamp' | 'level' | 'namespace';

const COLUMN_LIMITS: Record<ResizableColumn, { min: number; max: number }> = {
  timestamp: { min: 120, max: 420 },
  level: { min: 50, max: 180 },
  namespace: { min: 100, max: 520 },
};

const DEFAULT_COLUMN_WIDTHS: Record<ResizableColumn, number> = {
  timestamp: 200,
  level: 70,
  namespace: 280,
};

const LogViewer: React.FC<LogViewerProps> = ({
  filePath,
  filePaths,
  schema,
  autoRefresh,
  selectedNamespaces,
  onNamespacesChange,
  onResetFilters,
  editorOrder,
}) => {
  const { t } = useTranslation();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<LogEntry[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAsFilter, setSearchAsFilter] = useState(false);
  const [searchMatchIndices, setSearchMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isCompactSearchOpen, setIsCompactSearchOpen] = useState(false);
  const [isCompactSearchMode, setIsCompactSearchMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const [viewerHeight, setViewerHeight] = useState(600);

  // Allows scrolling past the last entry so it can be centered on screen
  const innerElementType = useMemo(
    () =>
      React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        ({ style, ...rest }, ref) => {
          const extraSpace = Math.floor(viewerHeight / 2);
          const originalHeight = parseFloat((style?.height as string) ?? '0');
          return (
            <div ref={ref} style={{ ...style, height: originalHeight + extraSpace }} {...rest} />
          );
        }
      ),
    [viewerHeight]
  );
  const [autoScroll, setAutoScroll] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<ResizableColumn, number>>(DEFAULT_COLUMN_WIDTHS);
  const [logContextMenu, setLogContextMenu] = useState<{ x: number; y: number; entry: LogEntry } | null>(null);

  useEffect(() => {
    if (!logContextMenu) return;
    const close = () => setLogContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [logContextMenu]);
  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const toolbarMainRowRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchControlRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ column: ResizableColumn; startX: number; startWidth: number } | null>(null);
  const lastFileSizeRef = useRef<number>(0);
  const scrollPositionRef = useRef<{ scrollOffset: number; scrollUpdateWasRequested: boolean }>({ scrollOffset: 0, scrollUpdateWasRequested: false });
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);
  const previousFiltersRef = useRef<{ levels: LogLevel[]; namespaces: string[]; search: string }>({ levels: [], namespaces: [], search: '' });

  const updateViewerHeight = useCallback(() => {
    const containerHeight = containerRef.current?.clientHeight ?? 0;
    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    const nextHeight = Math.max(containerHeight - headerHeight, 0);

    setViewerHeight((previousHeight) => (
      previousHeight === nextHeight ? previousHeight : nextHeight
    ));
  }, []);

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

  useLayoutEffect(() => {
    updateViewerHeight();

    const container = containerRef.current;
    const header = headerRef.current;
    const supportsResizeObserver = typeof ResizeObserver !== 'undefined';
    const resizeObserver = supportsResizeObserver
      ? new ResizeObserver(() => {
          updateViewerHeight();
        })
      : null;

    if (resizeObserver && container) {
      resizeObserver.observe(container);
    }

    if (resizeObserver && header) {
      resizeObserver.observe(header);
    }

    window.addEventListener('resize', updateViewerHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateViewerHeight);
    };
  }, [filteredEntries.length, updateViewerHeight]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!searchControlRef.current) return;
      if (!searchControlRef.current.contains(event.target as Node)) {
        setIsCompactSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  useEffect(() => {
    const toolbarRow = toolbarMainRowRef.current;
    if (!toolbarRow) return;

    const updateCompactMode = () => {
      const width = toolbarRow.clientWidth;
      if (width <= 0) {
        setIsCompactSearchMode(false);
        return;
      }
      const hasOverflow = toolbarRow.scrollWidth > toolbarRow.clientWidth + 1;
      setIsCompactSearchMode(width < 980 || hasOverflow);
    };

    updateCompactMode();

    const observer = new ResizeObserver(() => {
      updateCompactMode();
    });
    observer.observe(toolbarRow);

    return () => {
      observer.disconnect();
    };
  }, [filteredEntries.length, logEntries.length, selectedLevels.length, selectedNamespaces.length, searchQuery]);

  useEffect(() => {
    if (!isCompactSearchMode) {
      setIsCompactSearchOpen(false);
    }
  }, [isCompactSearchMode]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const { column, startX, startWidth } = resizeState;
      const { min, max } = COLUMN_LIMITS[column];
      const nextWidth = Math.min(max, Math.max(min, startWidth + (event.clientX - startX)));

      setColumnWidths((prev) => {
        if (prev[column] === nextWidth) return prev;
        return { ...prev, [column]: nextWidth };
      });
    };

    const handleMouseUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    // Multiple files: use loadMultipleLogFiles
    if (filePaths && filePaths.length > 1) {
      hasLoadedRef.current = false;
      loadMultipleLogFiles(filePaths);
      return;
    }
    
    // Single file: use loadLogFile
    if (filePath) {
      hasLoadedRef.current = false;
      loadLogFile();
      
      if (window.electronAPI) {
        // Setup file watcher only for single file
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
        
        return () => {
          window.electronAPI.unwatchLogFile(filePath);
          window.electronAPI.removeLogFileChangedListener();
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, filePaths?.join('|')]); // Use join to create stable dependency for filePaths

  // Reload file when schema changes
  useEffect(() => {
    if (filePath && hasLoadedRef.current) {
      console.log('Schema changed - reloading file with new schema');
      // Reset loaded flag to force full reload
      hasLoadedRef.current = false;
      lastFileSizeRef.current = 0;
      setLogEntries([]);
      loadLogFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.pattern, schema.timestampFormat, schema.fields.timestamp, schema.fields.level, schema.fields.namespace, schema.fields.message, filePath]);

  useEffect(() => {
    // Prüfe ob sich die Filterung geändert hat
    const filtersChanged = 
      previousFiltersRef.current.levels.length !== selectedLevels.length ||
      previousFiltersRef.current.levels.some((l, i) => l !== selectedLevels[i]) ||
      previousFiltersRef.current.namespaces.length !== selectedNamespaces.length ||
      previousFiltersRef.current.namespaces.some((n, i) => n !== selectedNamespaces[i]) ||
      previousFiltersRef.current.search !== (searchAsFilter ? searchQuery : '');
    
    // Update previous filters
    previousFiltersRef.current = {
      levels: [...selectedLevels],
      namespaces: [...selectedNamespaces],
      search: searchAsFilter ? searchQuery : '',
    };
    
    // Save current scroll position BEFORE any state change if tracking is off
    if (!autoScroll && listRef.current) {
      const currentState = listRef.current.state as any;
      const currentOffset = currentState.scrollOffset || scrollPositionRef.current.scrollOffset;
      if (currentOffset > 0) {
        pendingScrollRestoreRef.current = currentOffset;
        console.log('Saving scroll position before state change:', currentOffset);
      }
    }
    
    const filtered = filterLogEntries(logEntries, selectedLevels, selectedNamespaces, searchAsFilter ? searchQuery : '');
    setFilteredEntries(filtered);
    console.log(`LogViewer: ${filtered.length} of ${logEntries.length} entries after filtering`);
    
    // Bereinige expandierte Zeilen: entferne nur Expansionen für Zeilen, die nicht mehr sichtbar sind
    // Behalte Expansionen für Zeilen, die noch in der gefilterten Liste sind
    setExpandedLines((prev) => {
      if (prev.size === 0) return prev; // Keine Änderung nötig wenn nichts expandiert ist
      
      const visibleLineNumbers = new Set(filtered.map(e => e.originalLineNumber));
      const cleaned = new Set<number>();
      
      prev.forEach(lineNumber => {
        if (visibleLineNumbers.has(lineNumber)) {
          // Zeile ist noch sichtbar, behalte Expansion
          cleaned.add(lineNumber);
        }
        // Zeile ist nicht mehr sichtbar, entferne Expansion (nicht hinzufügen)
      });
      
      return cleaned;
    });
    
    // Wenn sich die Filterung geändert hat, reset die List und scroll zum Anfang
    if (filtersChanged && listRef.current) {
      console.log('Filter changed - resetting list and scrolling to top');
      // Reset den Cache der List
      listRef.current.resetAfterIndex(0, true);
      // Scroll zum Anfang
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTo(0);
          pendingScrollRestoreRef.current = null; // Clear pending restore
        }
      });
    }
  }, [logEntries, selectedLevels, selectedNamespaces, searchQuery, searchAsFilter, autoScroll]);

  const loadMultipleLogFiles = useCallback(async (filePaths: string[]) => {
    if (!window.electronAPI || filePaths.length === 0) return;

    setLoading(true);
    console.log(`Loading ${filePaths.length} log files...`);

    try {
      // Load all files in parallel
      const filePromises = filePaths.map(async (path) => {
        const result = await window.electronAPI.readLogFile(path);
        if (result.success && result.content) {
          const entries = parseLogFile(result.content, schema);
          // Store full path and original line number before merging
          return entries.map(entry => ({
            ...entry,
            sourceFile: path,
            sourceLineNumber: entry.originalLineNumber,
          }));
        }
        return [];
      });

      const allEntriesArrays = await Promise.all(filePromises);
      
      // Merge all entries
      let allEntries: LogEntry[] = [];
      allEntriesArrays.forEach(entries => {
        allEntries = [...allEntries, ...entries];
      });

      // Sort by timestamp
      allEntries.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

      // Reassign line numbers after sorting
      allEntries = allEntries.map((entry, index) => ({
        ...entry,
        originalLineNumber: index + 1,
      }));

      console.log(`Loaded ${allEntries.length} entries from ${filePaths.length} files`);
      setLogEntries(allEntries);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading multiple log files:', error);
    } finally {
      setLoading(false);
    }
  }, [schema]);

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

  // Gemessene tatsächliche DOM-Höhen für expandierte Zeilen
  const expandedHeightCache = useRef<Map<number, number>>(new Map());

  // Berechnet die Höhe eines expandierten Eintrags aus echten CSS-Metriken —
  // kein DOM-Mess-Callback nötig, kein re-render-Loop durch scroll-triggered ref.
  const getExpandHeight = useCallback((entry: LogEntry): number => {
    const text = entry.isMultiLine ? entry.fullText : entry.message;
    const content = analyzeAndFormatContent(text);
    const rawText = content.isHtml ? content.formatted.replace(/<[^>]*>/g, '') : content.formatted;

    // Tatsächliche Font-Größe des Root-Elements (berücksichtigt Benutzereinstellung)
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
    // Consolas/Monaco: durchschnittliche Zeichenbreite ≈ 60 % der Font-Größe
    const charWidth = rootFontSize * 0.601;

    // CSS line-height je Typ:
    //   .log-content-exception → line-height: 1.8
    //   alle anderen           → line-height: 1.6 (von .log-full-text)
    const lineHeightPx = rootFontSize * (content.type === 'exception' ? 1.8 : 1.6);

    // Nutzbare Breite: Container minus Padding (16px je Seite) und Scrollbar (~14px)
    const listAny = listRef.current as any;
    const outerEl: HTMLDivElement | null = listAny?._outerRef ?? null;
    const containerW = outerEl ? Math.max(300, outerEl.clientWidth - 32 - 14) : 700;
    const charsPerLine = Math.floor(containerW / charWidth);

    const isJsonXml = content.type === 'json' || content.type === 'xml';
    const isCode = isJsonXml || content.type === 'exception'; // alle haben padding: 12px
    const lines = rawText.split('\n');
    // json/xml: white-space:pre → kein Umbruch
    // exception/text: pre-wrap → Umbruch nach charsPerLine Zeichen
    const textLineCount = isJsonXml
      ? lines.length
      : lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);

    // Vertikales Chrome des .log-entry-details:
    //   padding: 12px 16px → 24px  +  border-top: 1px → 25 px total
    const DETAILS_PADDING = 25;
    // Header-Div (immer gerendert mit marginBottom: 8px):
    //   type 'text'  → leer, nur 8 px Margin
    //   alle anderen → Copy-Button/Badge ca. 30 px + 8 px Margin = 38 px
    const HEADER_H = content.type === 'text' ? 8 : 38;
    // json/xml/exception: .log-content-* hat padding: 12px → 24 px vertikal
    const EXTRA_CODE_PADDING = isCode ? 24 : 0;
    // .log-full-text margin: 0 0 4px 0
    const PRE_MARGIN = 4;

    const rawTextH = textLineCount * lineHeightPx;
    // .log-content-exception hat max-height: 750px (scrollt intern darüber hinaus)
    const cappedTextH = content.type === 'exception' ? Math.min(rawTextH, 750) : rawTextH;

    const detailsH = DETAILS_PADDING + HEADER_H + cappedTextH + EXTRA_CODE_PADDING + PRE_MARGIN;
    return Math.round(30 + detailsH);
  }, [analyzeAndFormatContent]);

  const toggleExpand = useCallback((originalLineNumber: number) => {
    const entry = filteredEntries.find(e => e.originalLineNumber === originalLineNumber);
    const index = filteredEntries.findIndex(e => e.originalLineNumber === originalLineNumber);
    if (index < 0) return;

    const listAny = listRef.current as any;
    const outerEl: HTMLDivElement | null = listAny?._outerRef ?? null;
    const scrollBefore = outerEl?.scrollTop ?? 0;
    // Pixel-Offset des Items VOR dem Reset (aus react-window internem Cache)
    // -1 als Fallback damit die Bedingung unten nicht fälschlicherweise greift
    const itemOffset: number = listAny?._instanceProps?.itemMetadataMap?.[index]?.offset ?? -1;

    const isExpanding = !expandedLines.has(originalLineNumber);
    const prevH = isExpanding ? 30 : (expandedHeightCache.current.get(originalLineNumber) ?? 30);
    let delta: number;

    if (isExpanding) {
      const estimatedH = entry ? getExpandHeight(entry) : 30;
      expandedHeightCache.current.set(originalLineNumber, estimatedH);
      delta = estimatedH - 30;
    } else {
      const cachedH = expandedHeightCache.current.get(originalLineNumber) ?? 30;
      expandedHeightCache.current.delete(originalLineNumber);
      delta = 30 - cachedH;
    }

    setExpandedLines((prev) => {
      const newSet = new Set(prev);
      if (isExpanding) newSet.add(originalLineNumber);
      else newSet.delete(originalLineNumber);
      return newSet;
    });

    if (listAny?.resetAfterIndex) {
      listAny.resetAfterIndex(index);
      // Nur kompensieren wenn das Item vollständig oberhalb des Viewports liegt
      // (= alle sichtbaren Einträge sind unterhalb des veränderten Items und
      //  verschieben sich um delta Pixel → scrollTop muss mitgezogen werden).
      // itemOffset + prevH <= scrollBefore bedeutet: Item-Ende liegt über Viewport-Oberkante.
      if (itemOffset >= 0 && itemOffset + prevH <= scrollBefore) {
        requestAnimationFrame(() => {
          if (outerEl) outerEl.scrollTop = scrollBefore + delta;
        });
      }
    }
  }, [filteredEntries, expandedLines, getExpandHeight]);

  const scrollToEnd = useCallback(() => {
    const listApi = listRef.current as unknown as {
      scrollToItem?: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
      scrollTo?: (offset: number) => void;
    } | null;
    if (listApi && filteredEntries.length > 0) {
      if (typeof listApi.scrollToItem === 'function') {
        listApi.scrollToItem(filteredEntries.length - 1, 'end');
      } else if (typeof listApi.scrollTo === 'function') {
        listApi.scrollTo(Number.MAX_SAFE_INTEGER);
      }
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

  const getResizableColumnStyle = useCallback((column: ResizableColumn): React.CSSProperties => {
    const width = columnWidths[column];
    return {
      width,
      minWidth: width,
      maxWidth: width,
    };
  }, [columnWidths]);

  const startColumnResize = useCallback((column: ResizableColumn, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      column,
      startX: event.clientX,
      startWidth: columnWidths[column],
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const toggleCompactSearch = useCallback(() => {
    if (!isCompactSearchMode) return;
    setIsCompactSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      return next;
    });
  }, [isCompactSearchMode]);

  // Compute match indices whenever filteredEntries or searchQuery changes
  useEffect(() => {
    if (!searchQuery.trim() || searchAsFilter) {
      setSearchMatchIndices([]);
      setCurrentMatchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    filteredEntries.forEach((entry, idx) => {
      const haystack = (entry.message + ' ' + entry.namespace + ' ' + entry.timestamp + ' ' + entry.level).toLowerCase();
      if (haystack.includes(q)) indices.push(idx);
    });
    setSearchMatchIndices(indices);
    setCurrentMatchIndex(0);
  }, [filteredEntries, searchQuery, searchAsFilter]);

  // Scroll to current match whenever it changes
  useEffect(() => {
    if (searchMatchIndices.length === 0) return;
    const targetIdx = searchMatchIndices[currentMatchIndex];
    if (targetIdx === undefined) return;
    const listApi = listRef.current as unknown as { scrollToItem?: (index: number, align?: string) => void } | null;
    listApi?.scrollToItem?.(targetIdx, 'smart');
  }, [searchMatchIndices, currentMatchIndex]);

  const goToNextMatch = useCallback(() => {
    if (searchMatchIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatchIndices.length);
  }, [searchMatchIndices]);

  const goToPrevMatch = useCallback(() => {
    if (searchMatchIndices.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatchIndices.length) % searchMatchIndices.length);
  }, [searchMatchIndices]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) goToPrevMatch(); else goToNextMatch();
    } else if (e.key === 'Escape') {
      setIsCompactSearchOpen(false);
    }
  }, [goToNextMatch, goToPrevMatch]);

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

    if (!expandedLines.has(entry.originalLineNumber)) return 30;

    // Cache enthält die Schätzung (direkt bei toggleExpand gesetzt) oder die gemessene Höhe
    return expandedHeightCache.current.get(entry.originalLineNumber) ?? 30;
  }, [filteredEntries, expandedLines]);

  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyToast = useCallback(() => {
    if (copyToastTimer.current) clearTimeout(copyToastTimer.current);
    setCopyToastVisible(false);
    // Kurzer Tick damit React den Toast neu mountet und die Animation neu startet
    requestAnimationFrame(() => {
      setCopyToastVisible(true);
      copyToastTimer.current = setTimeout(() => setCopyToastVisible(false), 3000);
    });
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showCopyToast();
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, [showCopyToast]);

  // Highlight matching text in a string for display
  const highlightText = useCallback((text: string, isActiveMatch: boolean): React.ReactNode => {
    if (!searchQuery || searchAsFilter) return text;
    const q = searchQuery.toLowerCase();
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;
    while (remaining.length > 0) {
      const idx = remaining.toLowerCase().indexOf(q);
      if (idx === -1) { parts.push(remaining); break; }
      if (idx > 0) parts.push(remaining.slice(0, idx));
      parts.push(
        <mark key={keyIdx++} className={`search-highlight${isActiveMatch ? ' search-highlight-active' : ''}`}>
          {remaining.slice(idx, idx + q.length)}
        </mark>
      );
      remaining = remaining.slice(idx + q.length);
    }
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  }, [searchQuery, searchAsFilter]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const entry = filteredEntries[index];
    if (!entry) return null;

    const isExpanded = expandedLines.has(entry.originalLineNumber);
    const isLongMessage = entry.message.length > 150;
    const shouldShowExpand = entry.isMultiLine || isLongMessage;
    const isSearchMatch = !searchAsFilter && searchMatchIndices.includes(index);
    const isActiveMatch = isSearchMatch && searchMatchIndices[currentMatchIndex] === index;

    // Analysiere und formatiere den Inhalt wenn expandiert
    const expandedContent = isExpanded ? analyzeAndFormatContent(entry.isMultiLine ? entry.fullText : entry.message) : null;

    // Bereite Tooltips vor für abgeschnittenen Text
    const displayedMessage = isExpanded
      ? entry.message
      : entry.isMultiLine
      ? entry.message.split('\n')[0] + ' ...'
      : isLongMessage
      ? entry.message.substring(0, 150) + ' ...'
      : entry.message;
    
    const messageTooltip = entry.message || undefined;
    
    // Prüfe ob Namespace abgeschnitten ist (wenn er länger als die verfügbare Breite ist)
    const namespaceTooltip = entry.namespace.length > 30 ? entry.namespace : undefined;

    return (
      <div style={style} className={`log-entry${isExpanded ? ' log-entry-expanded' : ''}${isActiveMatch ? ' log-entry-active-match' : isSearchMatch ? ' log-entry-search-match' : ''}`}>
        <div
          className={`log-entry-line ${shouldShowExpand ? 'multiline' : ''}`}
          onClick={() => shouldShowExpand && toggleExpand(entry.originalLineNumber)}
          onContextMenu={(e) => {
            e.preventDefault();
            setLogContextMenu({ x: e.clientX, y: e.clientY, entry });
          }}
        >
          <div className="log-line-number-group">
            {filePaths && filePaths.length > 1 && entry.sourceLineNumber != null && (
              <span
                className="log-source-line"
                title={entry.sourceFile ? `${entry.sourceFile}:${entry.sourceLineNumber}` : String(entry.sourceLineNumber)}
              >
                {entry.sourceLineNumber}
              </span>
            )}
            <span className="log-line-number">{entry.originalLineNumber}</span>
          </div>
          <span 
            className="log-timestamp" 
            style={getResizableColumnStyle('timestamp')}
            title={entry.timestamp}
          >
            {entry.timestamp}
          </span>
          <span
            className="log-level"
            style={{ ...getResizableColumnStyle('level'), color: getLevelColor(entry.level) }}
            title={entry.level}
          >
            {entry.level}
          </span>
          <span 
            className="log-namespace" 
            style={getResizableColumnStyle('namespace')}
            title={namespaceTooltip}
          >
            {highlightText(entry.namespace, isActiveMatch)}
          </span>
          <span 
            className="log-message"
            title={messageTooltip}
          >
            {highlightText(displayedMessage, isActiveMatch)}
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
                  title={t('app.copy')}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4V2C4 1.44772 4.44772 1 5 1H13C13.5523 1 14 1.44772 14 2V10C14 10.5523 13.5523 11 13 11H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="2" y="5" width="9" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  {t('app.copy')}
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
  }, [filteredEntries, expandedLines, toggleExpand, analyzeAndFormatContent, getResizableColumnStyle, filePaths, highlightText, searchMatchIndices, currentMatchIndex, searchAsFilter]);

  // Check if we have any files to display (single or multiple)
  const hasFiles = filePath || (filePaths && filePaths.length > 0);
  const hasActiveFilters = selectedLevels.length > 0 || selectedNamespaces.length > 0 || Boolean(searchAsFilter && searchQuery);
  const visibleLevelCount = 3;
  const selectedLevelsBadge = selectedLevels.length > visibleLevelCount
    ? `${selectedLevels.slice(0, visibleLevelCount).join(', ')}, ...`
    : selectedLevels.join(', ');
  const searchBadge = searchQuery.length > 28
    ? `${searchQuery.slice(0, 28)}...`
    : searchQuery;
  
  if (!hasFiles) {
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
    <>
    <div className="log-viewer">
      <div className="log-viewer-toolbar">
        <div className="log-level-row">
          <div className="filter-group log-level-group">
            <label>Log-Level:</label>
            <div className="filter-buttons log-level-buttons">
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
        </div>
        <div className="toolbar-main-row" ref={toolbarMainRowRef}>
          <div className="log-viewer-filters">
            <div className={`filter-group filter-group-search ${isCompactSearchMode ? 'compact-mode' : ''}`}>
              <label className="search-label">Search:</label>
              <div
                ref={searchControlRef}
                className={`search-control ${isCompactSearchMode ? 'compact-mode' : ''} ${isCompactSearchOpen ? 'compact-open' : ''}`}
              >
                {!isCompactSearchMode && (
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="search-input"
                    placeholder={t('logviewer.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); if (searchAsFilter) setSearchAsFilter(false); }}
                    onKeyDown={handleSearchKeyDown}
                  />
                )}
                {!isCompactSearchMode && searchQuery && !searchAsFilter && (
                  <span className={`search-match-counter ${searchMatchIndices.length === 0 ? 'no-match' : ''}`}>
                    {searchMatchIndices.length === 0
                      ? t('logviewer.searchNoMatch')
                      : t('logviewer.searchMatch', { current: currentMatchIndex + 1, total: searchMatchIndices.length })}
                  </span>
                )}
                {!isCompactSearchMode && searchQuery && !searchAsFilter && searchMatchIndices.length > 0 && (
                  <>
                    <button type="button" className="search-nav-button" title={t('logviewer.searchPrev')} onClick={goToPrevMatch}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 8L6 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button type="button" className="search-nav-button" title={t('logviewer.searchNext')} onClick={goToNextMatch}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4L6 7L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </>
                )}
                {!isCompactSearchMode && searchQuery && (
                  <button
                    type="button"
                    className={`search-as-filter-button ${searchAsFilter ? 'active' : ''}`}
                    title={t('logviewer.searchApplyFilter')}
                    onClick={() => setSearchAsFilter((prev) => !prev)}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    {t('logviewer.searchApplyFilter')}
                  </button>
                )}
                <button
                  type="button"
                  className="search-toggle-button"
                  aria-label="Toggle search"
                  onClick={toggleCompactSearch}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                {isCompactSearchMode && isCompactSearchOpen && (
                  <div className="search-dropdown">
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="search-input"
                      placeholder={t('logviewer.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); if (searchAsFilter) setSearchAsFilter(false); }}
                      onKeyDown={handleSearchKeyDown}
                    />
                    {searchQuery && !searchAsFilter && (
                      <div className="search-dropdown-controls">
                        <span className={`search-match-counter ${searchMatchIndices.length === 0 ? 'no-match' : ''}`}>
                          {searchMatchIndices.length === 0
                            ? t('logviewer.searchNoMatch')
                            : t('logviewer.searchMatch', { current: currentMatchIndex + 1, total: searchMatchIndices.length })}
                        </span>
                        {searchMatchIndices.length > 0 && (
                          <>
                            <button type="button" className="search-nav-button" title={t('logviewer.searchPrev')} onClick={goToPrevMatch}>
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 8L6 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                            <button type="button" className="search-nav-button" title={t('logviewer.searchNext')} onClick={goToNextMatch}>
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4L6 7L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className={`search-as-filter-button ${searchAsFilter ? 'active' : ''}`}
                          title={t('logviewer.searchApplyFilter')}
                          onClick={() => setSearchAsFilter((prev) => !prev)}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          {t('logviewer.searchApplyFilter')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={`log-viewer-stats ${hasActiveFilters ? 'has-filters' : ''}`}>
          <span className="stats-count">{t('logviewer.entries', { filtered: filteredEntries.length, total: logEntries.length })}</span>
          {selectedLevels.length > 0 && (
            <span className="filter-badge filter-badge-level" title={`${t('logviewer.levelBadge', { levels: selectedLevels.join(', ') })}`}>
              {t('logviewer.levelBadge', { levels: selectedLevelsBadge })}
            </span>
          )}
          {selectedNamespaces.length > 0 && (
            <span className="filter-badge" title={`${t('logviewer.namespaceBadge', { count: selectedNamespaces.length })}`}>
              {t('logviewer.namespaceBadge', { count: selectedNamespaces.length })}
            </span>
          )}
          {searchAsFilter && searchQuery && (
            <span className="filter-badge filter-badge-search" title={`${t('logviewer.searchBadge', { query: searchQuery })}`}>
              {t('logviewer.searchBadge', { query: searchBadge })}
            </span>
          )}
          {hasActiveFilters && onResetFilters && (
            <button 
              onClick={onResetFilters} 
              className="reset-filters-button"
              title={t('logviewer.resetFilters')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C9.84871 2 11.5051 2.84285 12.6 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12.5 2V4.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t('logviewer.reset')}
            </button>
          )}
          {filteredEntries.length > 0 && (
            <>
              <button 
                onClick={() => setAutoScroll(!autoScroll)} 
                className={`auto-scroll-button ${autoScroll ? 'active' : ''}`}
                title={autoScroll ? t('logviewer.disableTracking') : t('logviewer.enableTracking')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2V14M8 14L12 10M8 14L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                </svg>
                {autoScroll ? t('logviewer.trackingOn') : t('logviewer.trackingOff')}
              </button>
              <button onClick={scrollToEnd} className="scroll-to-end-button" title={t('logviewer.jumpToEnd')}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12L8 4M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 14L13 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {t('logviewer.end')}
              </button>
            </>
          )}
          </div>
        </div>
      </div>
      <div className="log-viewer-content" ref={containerRef}>
        {filteredEntries.length > 0 && (
          <div className="log-column-header" role="presentation" ref={headerRef}>
            <div className="log-column-header-line">
              <span className="log-column-header-cell log-column-header-line-number">{t('logviewer.colLine')}</span>
              <span className="log-column-header-cell log-column-header-resizable" style={getResizableColumnStyle('timestamp')}>
                {t('logviewer.colTimestamp')}
                <button
                  type="button"
                  className="log-column-resize-handle"
                  aria-label="Resize timestamp column"
                  onMouseDown={(event) => startColumnResize('timestamp', event)}
                />
              </span>
              <span className="log-column-header-cell log-column-header-resizable" style={getResizableColumnStyle('level')}>
                {t('logviewer.colLevel')}
                <button
                  type="button"
                  className="log-column-resize-handle"
                  aria-label="Resize level column"
                  onMouseDown={(event) => startColumnResize('level', event)}
                />
              </span>
              <span className="log-column-header-cell log-column-header-resizable" style={getResizableColumnStyle('namespace')}>
                {t('logviewer.colNamespace')}
                <button
                  type="button"
                  className="log-column-resize-handle"
                  aria-label="Resize namespace column"
                  onMouseDown={(event) => startColumnResize('namespace', event)}
                />
              </span>
              <span className="log-column-header-cell log-column-header-message">{t('logviewer.colMessage')}</span>
            </div>
          </div>
        )}
        {loading ? (
          <div className="log-viewer-loading">{t('logviewer.loading')}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="log-viewer-empty">{t('logviewer.noEntries')}</div>
        ) : (
          <VariableSizeList
            ref={listRef}
            height={viewerHeight}
            itemCount={filteredEntries.length}
            itemSize={getItemSize}
            itemKey={(index: number) => filteredEntries[index]?.originalLineNumber ?? index}
            width="100%"
            estimatedItemSize={30}
            onScroll={handleScroll}
            innerElementType={innerElementType}
          >
            {Row}
          </VariableSizeList>
        )}
      </div>
      {logContextMenu && (
        <div
          className="log-context-menu"
          style={{ top: logContextMenu.y, left: logContextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="log-context-menu-item"
            onClick={() => {
              const { entry } = logContextMenu;
              const text = [entry.timestamp, entry.level, entry.namespace, entry.message].filter(Boolean).join(' | ');
              navigator.clipboard.writeText(text).then(() => showCopyToast());
              setLogContextMenu(null);
            }}
          >
            {t('app.copyEntry')}
          </button>
          <button
            className="log-context-menu-item"
            onClick={() => {
              const { entry } = logContextMenu;
              const currentFile = entry.sourceFile ?? (filePaths && filePaths.length > 0 ? filePaths[0] : filePath);
              const lineNum = entry.sourceLineNumber ?? entry.originalLineNumber;
              if (currentFile) {
                window.electronAPI?.openFileInEditor(currentFile, lineNum, editorOrder);
              }
              setLogContextMenu(null);
            }}
          >
            {t('app.openInEditor')}
          </button>
          {filePaths && filePaths.length > 1 && logContextMenu.entry.sourceFile && (
            <div className="log-context-menu-info">
              📄 {logContextMenu.entry.sourceFile.split(/[/\\]/).pop()}
              {logContextMenu.entry.sourceLineNumber && ` · ${t('app.line', { line: logContextMenu.entry.sourceLineNumber })}`}
            </div>
          )}
        </div>
      )}
    </div>
    <Toast message={t('logviewer.copiedToClipboard')} visible={copyToastVisible} />
  </>
  );
};

export default LogViewer;
