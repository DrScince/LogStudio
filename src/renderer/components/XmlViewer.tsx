import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { highlightXml } from '../utils/xmlHighlighter';
import { formatXml } from '../utils/xmlFormatter';
import './XmlViewer.css';

interface XmlViewerProps {
  filePath: string;
}

type ViewMode = 'raw' | 'tree';

// ─────────────────────────────────────────────
// XML Tree Node (recursive)
// ─────────────────────────────────────────────

interface XmlTreeNodeProps {
  node: Node;
  depth: number;
  defaultCollapsed: boolean;
  xmlDoc?: Document;
  onContentChange?: (xml: string) => void;
}

const XmlTreeNode: React.FC<XmlTreeNodeProps> = ({
  node,
  depth,
  defaultCollapsed,
  xmlDoc,
  onContentChange,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (node.nodeType === Node.COMMENT_NODE) {
    return (
      <div className="xml-tree-row" style={{ paddingLeft: depth * 20 + 28 }}>
        <span className="xml-tree-comment">{`<!-- ${node.textContent?.trim()} -->`}</span>
      </div>
    );
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return (
      <div className="xml-tree-row" style={{ paddingLeft: depth * 20 + 28 }}>
        <span className="xml-tree-text-block">{text}</span>
      </div>
    );
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const attrs = Array.from(el.attributes);

  // Only element/comment children cause expand-collapse; text nodes are shown inline
  const elementChildren = Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.COMMENT_NODE
  );
  const hasChildren = elementChildren.length > 0;

  // Find a direct text node for leaf elements
  const textDomNodes = Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()
  );
  const inlineText =
    !hasChildren && textDomNodes.length > 0
      ? textDomNodes.map((n) => n.textContent?.trim()).filter(Boolean).join(' ')
      : '';
  const textDomNode = textDomNodes[0] ?? null;
  const canEdit = !!onContentChange && !hasChildren && textDomNode !== null;

  const startEdit = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    setEditValue(inlineText);
    setIsEditing(true);
  };

  const commitEdit = () => {
    if (!xmlDoc || !onContentChange || !textDomNode) {
      setIsEditing(false);
      return;
    }
    textDomNode.textContent = editValue;
    const raw = new XMLSerializer().serializeToString(xmlDoc);
    onContentChange(formatXml(raw));
    setIsEditing(false);
  };

  const cancelEdit = () => setIsEditing(false);

  return (
    <div className="xml-tree-node">
      <div
        className="xml-tree-row"
        style={{ paddingLeft: depth * 20 }}
        onClick={() => hasChildren && setCollapsed((c) => !c)}
      >
        <span className="xml-tree-chevron" style={{ visibility: hasChildren ? 'visible' : 'hidden' }}>
          {collapsed ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span className="xml-tree-tag-name">{el.localName || el.nodeName}</span>
        {attrs.map((attr) => (
          <span key={attr.name} className="xml-tree-attr">
            <span className="xml-tree-attr-name">{attr.name}</span>
            <span className="xml-tree-attr-eq">=</span>
            <span className="xml-tree-attr-val">&quot;{attr.value}&quot;</span>
          </span>
        ))}

        {/* Inline value — editable leaf */}
        {inlineText && !isEditing && (
          <span
            className={`xml-tree-text-inline ${canEdit ? 'xml-tree-editable' : ''}`}
            onClick={startEdit}
            title={canEdit ? 'Click to edit' : undefined}
          >
            {inlineText}
          </span>
        )}
        {isEditing && (
          <input
            ref={inputRef}
            className="xml-tree-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Empty leaf indicator */}
        {!hasChildren && !inlineText && !isEditing && (
          <span className="xml-tree-empty">/</span>
        )}
      </div>
      {hasChildren && !collapsed && (
        <div className="xml-tree-children">
          {elementChildren.map((child, i) => (
            <XmlTreeNode
              key={i}
              node={child}
              depth={depth + 1}
              defaultCollapsed={defaultCollapsed}
              xmlDoc={xmlDoc}
              onContentChange={onContentChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main XmlViewer component
// ─────────────────────────────────────────────

const XmlViewer: React.FC<XmlViewerProps> = ({ filePath }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [treeKey, setTreeKey] = useState(0);
  const [treeDefaultCollapsed, setTreeDefaultCollapsed] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [externallyChanged, setExternallyChanged] = useState(false);

  const isDirty = content !== savedContent;

  // ── Load file ──────────────────────────────
  const loadFile = useCallback((path: string) => {
    return window.electronAPI.readLogFile(path).then((result) => {
      if (result.success && result.content !== undefined) {
        setContent(result.content);
        setSavedContent(result.content);
      }
    });
  }, []);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setExternallyChanged(false);
    loadFile(filePath).finally(() => setLoading(false));
  }, [filePath, loadFile]);

  // Keep a ref to isDirty so the watcher callback can read the current value
  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // ── Watch for external changes ─────────────
  useEffect(() => {
    if (!filePath) return;
    window.electronAPI.watchLogFile(filePath);
    const unsubscribe = window.electronAPI.onLogFileChanged((changedPath: string) => {
      if (changedPath !== filePath) return;
      if (isDirtyRef.current) {
        // User has unsaved edits — show banner so they can decide
        setExternallyChanged(true);
      } else {
        // No unsaved edits — reload silently
        loadFile(filePath);
      }
    });
    return () => {
      window.electronAPI.unwatchLogFile(filePath);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [filePath, loadFile]);

  // ── Restore cursor after state update ──────
  useEffect(() => {
    if (pendingCursorRef.current !== null && textareaRef.current) {
      textareaRef.current.selectionStart = pendingCursorRef.current;
      textareaRef.current.selectionEnd = pendingCursorRef.current;
      pendingCursorRef.current = null;
    }
  });

  // ── Save ───────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setSaveStatus('saving');
    const result = await window.electronAPI.writeXmlFile(filePath, content);
    if (result.success) {
      setSavedContent(content);
      setSaveStatus('saved');
      setExternallyChanged(false);
    } else {
      setSaveStatus('error');
    }
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
  }, [filePath, content, isDirty]);

  // Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  // ── Revert ─────────────────────────────────
  const handleRevert = () => {
    setContent(savedContent);
  };

  // Track Ctrl+K chord
  const ctrlKPendingRef = useRef(false);

  // ── Textarea key handler ───────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // ── Ctrl+K chord handling ────────────────
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      ctrlKPendingRef.current = true;
      return;
    }
    if (ctrlKPendingRef.current) {
      ctrlKPendingRef.current = false;

      // Ctrl+K, D → Format document
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        try {
          setContent(formatXml(content));
        } catch {
          // leave as-is if XML is invalid
        }
        return;
      }

      // Ctrl+K, C → Add comment on line / selection
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const lines = content.split('\n');
        let charCount = 0;
        const lineRanges: { start: number; end: number }[] = [];
        for (const line of lines) {
          lineRanges.push({ start: charCount, end: charCount + line.length });
          charCount += line.length + 1;
        }
        const touchedIdx = lineRanges.reduce<number[]>((acc, r, i) => {
          if (r.end >= start && r.start <= end) acc.push(i);
          return acc;
        }, []);
        const newLines = [...lines];
        for (const i of touchedIdx) {
          const m = newLines[i].match(/^(\s*)(.*?)(\s*)$/);
          if (m && m[2].trim() && !/^\s*<!--.*-->\s*$/.test(newLines[i])) {
            newLines[i] = `${m[1]}<!-- ${m[2].trim()} -->${m[3]}`;
          }
        }
        setContent(newLines.join('\n'));
        pendingCursorRef.current = start;
        return;
      }

      // Ctrl+K, U → Remove comment on line / selection
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const lines = content.split('\n');
        let charCount = 0;
        const lineRanges: { start: number; end: number }[] = [];
        for (const line of lines) {
          lineRanges.push({ start: charCount, end: charCount + line.length });
          charCount += line.length + 1;
        }
        const touchedIdx = lineRanges.reduce<number[]>((acc, r, i) => {
          if (r.end >= start && r.start <= end) acc.push(i);
          return acc;
        }, []);
        const newLines = [...lines];
        for (const i of touchedIdx) {
          newLines[i] = newLines[i].replace(/^(\s*)<!--\s?(.*?)\s?-->(\s*)$/, '$1$2$3');
        }
        setContent(newLines.join('\n'));
        pendingCursorRef.current = start;
        return;
      }
    } else {
      ctrlKPendingRef.current = false;
    }

    // ── Shift+Delete → cut line ──────────────
    if (e.shiftKey && e.key === 'Delete') {
      e.preventDefault();
      const pos = ta.selectionStart;
      const lines = content.split('\n');
      let charCount = 0;
      let lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = charCount + lines[i].length;
        if (pos <= lineEnd) { lineIdx = i; break; }
        charCount += lines[i].length + 1;
      }
      const lineStart = charCount;
      const lineWithNewline = lines[lineIdx] + (lineIdx < lines.length - 1 ? '\n' : '');
      navigator.clipboard.writeText(lineWithNewline).catch(() => {});
      const newLines = [...lines];
      newLines.splice(lineIdx, 1);
      const newContent = newLines.join('\n');
      setContent(newContent);
      pendingCursorRef.current = Math.min(lineStart, newContent.length);
      return;
    }

    // ── Ctrl+X without selection → cut line ──
    if ((e.ctrlKey || e.metaKey) && e.key === 'x' && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      const pos = ta.selectionStart;
      const lines = content.split('\n');
      let charCount = 0;
      let lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = charCount + lines[i].length;
        if (pos <= lineEnd) { lineIdx = i; break; }
        charCount += lines[i].length + 1;
      }
      const lineStart = charCount;
      const lineWithNewline = lines[lineIdx] + (lineIdx < lines.length - 1 ? '\n' : '');
      navigator.clipboard.writeText(lineWithNewline).catch(() => {});
      const newLines = [...lines];
      newLines.splice(lineIdx, 1);
      const newContent = newLines.join('\n');
      setContent(newContent);
      pendingCursorRef.current = Math.min(lineStart, newContent.length);
      return;
    }

    // ── Tab → 2 spaces ───────────────────────
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = content.slice(0, start) + '  ' + content.slice(end);
      setContent(newValue);
      pendingCursorRef.current = start + 2;
      return;
    }

    // ── Enter → auto-indent ──────────────────
    if (e.key === 'Enter') {
      e.preventDefault();
      const pos = ta.selectionStart;
      const before = content.slice(0, pos);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      const indent = currentLine.match(/^(\s*)/)?.[1] ?? '';
      const newValue = content.slice(0, pos) + '\n' + indent + content.slice(ta.selectionEnd);
      setContent(newValue);
      pendingCursorRef.current = pos + 1 + indent.length;
      return;
    }

    // ── > → auto-close tag ───────────────────
    if (e.key === '>') {
      const pos = ta.selectionStart;
      const before = content.slice(0, pos);
      const tagStart = before.lastIndexOf('<');
      if (tagStart !== -1) {
        const tagContent = before.slice(tagStart + 1);
        if (
          !tagContent.startsWith('/') &&
          !tagContent.startsWith('!') &&
          !tagContent.startsWith('?') &&
          !tagContent.trimEnd().endsWith('/')
        ) {
          const tagName = tagContent.split(/[\s/>]/)[0];
          if (tagName && /^[a-zA-Z_][\w:.-]*$/.test(tagName)) {
            e.preventDefault();
            const insert = `></${tagName}>`;
            const newValue = content.slice(0, pos) + insert + content.slice(ta.selectionEnd);
            setContent(newValue);
            pendingCursorRef.current = pos + 1;
            return;
          }
        }
      }
    }
  };

  // ── Parse XML for tree view ─────────────────
  const xmlDoc = React.useMemo(() => {
    if (!content) return null;
    try {
      const parser = new DOMParser();
      return parser.parseFromString(content, 'text/xml');
    } catch {
      return null;
    }
  }, [content]);

  const parseError = xmlDoc?.querySelector('parsererror');
  const rootElement = !parseError ? xmlDoc?.documentElement ?? null : null;

  // ── Highlighted HTML ───────────────────────
  const highlightedHtml = React.useMemo(() => highlightXml(content), [content]);

  // ── File name for display ──────────────────
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // ── Tree expand / collapse all ─────────────
  const triggerCollapse = (collapsed: boolean) => {
    setTreeDefaultCollapsed(collapsed);
    setTreeKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="xml-viewer">
        <div className="xml-loading">{t('settings.selectingFolder')}</div>
      </div>
    );
  }

  return (
    <div className="xml-viewer">
      {/* ── External change banner (only when user has unsaved edits) ── */}
      {externallyChanged && (
        <div className="xml-external-banner">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>{t('xml.fileChangedExternally')}</span>
          <button
            className="xml-btn xml-btn-primary xml-btn-sm"
            onClick={() => { setExternallyChanged(false); loadFile(filePath); }}
          >
            {t('xml.reload')}
          </button>
          <button
            className="xml-btn xml-btn-ghost xml-btn-sm"
            onClick={() => setExternallyChanged(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────── */}
      <div className="xml-toolbar">
        <span className="xml-toolbar-filename">
          <svg className="xml-toolbar-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 2h9l3 3v9H2V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M11 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          {fileName}
        </span>

        {isDirty && <span className="xml-dirty-dot" title={t('xml.unsavedChanges')}>●</span>}

        <div className="xml-toolbar-sep" />

        {/* View toggle */}
        <div className="xml-view-toggle">
          <button
            className={`xml-view-btn ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
            title={t('xml.viewRaw')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('xml.viewRaw')}
          </button>
          <button
            className={`xml-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
            title={t('xml.viewTree')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6" y="7" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="11" y="2" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 5v2.5H13V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M8 7V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {t('xml.viewTree')}
          </button>
        </div>

        {viewMode === 'tree' && (
          <>
            <button className="xml-btn" onClick={() => triggerCollapse(false)} title={t('xml.expandAll')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 5l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t('xml.expandAll')}
            </button>
            <button className="xml-btn" onClick={() => triggerCollapse(true)} title={t('xml.collapseAll')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 11l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t('xml.collapseAll')}
            </button>
          </>
        )}

        <div className="xml-toolbar-spacer" />

        {/* Save status */}
        {saveStatus === 'saved' && <span className="xml-status xml-status-ok">✓ {t('xml.saved')}</span>}
        {saveStatus === 'error' && <span className="xml-status xml-status-err">{t('xml.saveError')}</span>}

        {isDirty && (
          <>
            <button className="xml-btn xml-btn-ghost" onClick={handleRevert} title={t('xml.revert')}>
              {t('xml.revert')}
            </button>
            <button className="xml-btn xml-btn-primary" onClick={handleSave} title="Ctrl+S">
              {t('xml.save')}
            </button>
          </>
        )}
      </div>

      {/* ── Raw view ────────────────────────────── */}
      {viewMode === 'raw' && (
        <div className="xml-raw-scroller" ref={scrollerRef}>
          <div className="xml-raw-content">
            <pre
              className="xml-highlight-pre"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
            />
            <textarea
              ref={textareaRef}
              className="xml-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      )}

      {/* ── Tree view ───────────────────────────── */}
      {viewMode === 'tree' && (
        <div className="xml-tree-scroller">
          {parseError ? (
            <div className="xml-parse-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              {t('xml.parseError')}
            </div>
          ) : rootElement ? (
            <div key={treeKey} className="xml-tree-root">
              {/* Declaration comment if present */}
              {content.startsWith('<?xml') && (
                <div className="xml-tree-decl">
                  {content.match(/^<\?xml[^?]*\?>/)?.[0] ?? '<?xml version="1.0"?>'}
                </div>
              )}
              <XmlTreeNode
                node={rootElement}
                depth={0}
                defaultCollapsed={treeDefaultCollapsed}
                xmlDoc={xmlDoc ?? undefined}
                onContentChange={(newXml) => setContent(newXml)}
              />
            </div>
          ) : (
            <div className="xml-parse-error">{t('xml.parseError')}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default XmlViewer;
