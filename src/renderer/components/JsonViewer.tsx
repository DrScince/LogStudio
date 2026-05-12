import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { highlightJson } from '../utils/jsonHighlighter';
import { HotkeyMap, DEFAULT_HOTKEYS } from '../utils/settings';
import './JsonViewer.css';

interface JsonViewerProps {
  filePath: string;
  hotkeys?: HotkeyMap;
}

type ViewMode = 'raw' | 'tree';

// ─────────────────────────────────────────────
// Helper: set a value at a nested path
// ─────────────────────────────────────────────

function setValueAtPath(
  obj: unknown,
  path: (string | number)[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (Array.isArray(obj)) {
    const arr = [...(obj as unknown[])];
    arr[key as number] = setValueAtPath(arr[key as number], rest, value);
    return arr;
  }
  if (obj !== null && typeof obj === 'object') {
    const o = { ...(obj as Record<string, unknown>) };
    o[key as string] = setValueAtPath(o[key as string], rest, value);
    return o;
  }
  return value;
}

// ─────────────────────────────────────────────
// Helper: move a line up or down
// ─────────────────────────────────────────────

function moveLine(
  content: string,
  pos: number,
  direction: 'up' | 'down',
): { content: string; cursor: number } {
  const lines = content.split('\n');
  let charCount = 0;
  let lineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = charCount + lines[i].length;
    if (pos <= lineEnd) { lineIdx = i; break; }
    charCount += lines[i].length + 1;
  }
  if (direction === 'up' && lineIdx === 0) return { content, cursor: pos };
  if (direction === 'down' && lineIdx === lines.length - 1) return { content, cursor: pos };

  const targetIdx = direction === 'up' ? lineIdx - 1 : lineIdx + 1;
  const newLines = [...lines];
  [newLines[lineIdx], newLines[targetIdx]] = [newLines[targetIdx], newLines[lineIdx]];
  const newContent = newLines.join('\n');

  // Recalculate cursor offset within the swapped line
  let newCharCount = 0;
  for (let i = 0; i < targetIdx; i++) newCharCount += newLines[i].length + 1;
  const colOffset = pos - charCount;
  const newCursor = Math.min(newCharCount + colOffset, newCharCount + newLines[targetIdx].length);
  return { content: newContent, cursor: newCursor };
}

// ─────────────────────────────────────────────
// JSON Tree Node (recursive)
// ─────────────────────────────────────────────

interface JsonTreeNodeProps {
  nodeKey?: string | number;
  value: unknown;
  depth: number;
  defaultCollapsed: boolean;
  path: (string | number)[];
  onValueChange?: (path: (string | number)[], newValue: unknown) => void;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  nodeKey,
  value,
  depth,
  defaultCollapsed,
  path,
  onValueChange,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCollapsed(defaultCollapsed); }, [defaultCollapsed]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const isArray = Array.isArray(value);
  const isObject = !isArray && value !== null && typeof value === 'object';
  const isLeaf = !isArray && !isObject;

  const startEdit = () => {
    if (!onValueChange) return;
    setEditValue(JSON.stringify(value));
    setIsEditing(true);
  };

  const commitEdit = () => {
    if (!onValueChange) { setIsEditing(false); return; }
    try {
      onValueChange(path, JSON.parse(editValue));
    } catch {
      onValueChange(path, editValue);
    }
    setIsEditing(false);
  };

  const indent = depth * 20 + 8;

  const keyLabel = nodeKey !== undefined ? (
    <span className="json-tree-key">
      {typeof nodeKey === 'string' ? `"${nodeKey}"` : nodeKey}
    </span>
  ) : null;
  const colonLabel = nodeKey !== undefined
    ? <span className="json-tree-colon">:&nbsp;</span>
    : null;

  // ── Leaf node ───────────────────────────────
  if (isLeaf) {
    let valueEl: React.ReactNode;
    if (value === null) {
      valueEl = <span className="json-val-null">null</span>;
    } else if (typeof value === 'boolean') {
      valueEl = <span className="json-val-bool">{String(value)}</span>;
    } else if (typeof value === 'number') {
      valueEl = <span className="json-val-number">{String(value)}</span>;
    } else {
      valueEl = <span className="json-val-string">{JSON.stringify(value)}</span>;
    }
    return (
      <div className="json-tree-row" style={{ paddingLeft: indent }}>
        <span className="json-tree-leaf-spacer" />
        {keyLabel}{colonLabel}
        {isEditing ? (
          <input
            ref={inputRef}
            className="json-tree-edit-input"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onBlur={commitEdit}
          />
        ) : (
          <span
            className={`json-tree-value ${onValueChange ? 'json-tree-editable' : ''}`}
            onClick={onValueChange ? startEdit : undefined}
            title={onValueChange ? 'Click to edit' : undefined}
          >
            {valueEl}
          </span>
        )}
      </div>
    );
  }

  // ── Container node (object / array) ─────────
  const entries: [string | number, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [i, v])
    : Object.entries(value as Record<string, unknown>);
  const count = entries.length;
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div className="json-tree-node">
      <div className="json-tree-row" style={{ paddingLeft: indent }}>
        <button
          className="json-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'expand' : 'collapse'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            {collapsed
              ? <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </button>
        {keyLabel}{colonLabel}
        <span className="json-tree-bracket">{openBracket}</span>
        {collapsed && (
          <>
            <span className="json-tree-ellipsis">…</span>
            <span className="json-tree-bracket">{closeBracket}</span>
            <span className="json-tree-count">{count}</span>
          </>
        )}
      </div>
      {!collapsed && (
        <>
          {entries.map(([k, v]) => (
            <JsonTreeNode
              key={String(k)}
              nodeKey={k}
              value={v}
              depth={depth + 1}
              defaultCollapsed={defaultCollapsed}
              path={[...path, k]}
              onValueChange={onValueChange}
            />
          ))}
          <div className="json-tree-row json-tree-close" style={{ paddingLeft: indent + 20 }}>
            <span className="json-tree-bracket">{closeBracket}</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main JsonViewer component
// ─────────────────────────────────────────────

const JsonViewer: React.FC<JsonViewerProps> = ({ filePath, hotkeys }) => {
  const { t } = useTranslation();
  const hk = hotkeys ?? DEFAULT_HOTKEYS;

  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [treeKey, setTreeKey] = useState(0);
  const [treeDefaultCollapsed, setTreeDefaultCollapsed] = useState(false);
  const [externallyChanged, setExternallyChanged] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrlKPendingRef = useRef(false);

  const isDirty = content !== savedContent;
  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

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

  // ── Watch for external changes ─────────────
  useEffect(() => {
    if (!filePath) return;
    window.electronAPI.watchLogFile(filePath);
    const unsubscribe = window.electronAPI.onLogFileChanged((changedPath: string) => {
      if (changedPath !== filePath) return;
      if (isDirtyRef.current) {
        setExternallyChanged(true);
      } else {
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
    const result = await window.electronAPI.writeJsonFile(filePath, content);
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

  // Ctrl+S (global)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const matchesSave = (e.ctrlKey || e.metaKey) === hk.save.ctrl &&
        e.key.toLowerCase() === hk.save.key.toLowerCase() &&
        !!e.altKey === hk.save.alt && !!e.shiftKey === hk.save.shift;
      if (matchesSave) { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, hk]);

  // ── Revert ─────────────────────────────────
  const handleRevert = () => setContent(savedContent);

  // ── Tree value change ──────────────────────
  const handleTreeValueChange = useCallback(
    (path: (string | number)[], newValue: unknown) => {
      try {
        const parsed = JSON.parse(content);
        const updated = setValueAtPath(parsed, path, newValue);
        setContent(JSON.stringify(updated, null, 2));
      } catch { /* ignore if content is malformed */ }
    },
    [content],
  );

  // ── Textarea key handler ───────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // ── Alt+Up: move line up ─────────────────
    if (e.altKey && !e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const { content: nc, cursor } = moveLine(content, ta.selectionStart, 'up');
      setContent(nc);
      pendingCursorRef.current = cursor;
      return;
    }

    // ── Alt+Down: move line down ─────────────
    if (e.altKey && !e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const { content: nc, cursor } = moveLine(content, ta.selectionStart, 'down');
      setContent(nc);
      pendingCursorRef.current = cursor;
      return;
    }

    // ── Ctrl+K chord ─────────────────────────
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      ctrlKPendingRef.current = true;
      return;
    }
    if (ctrlKPendingRef.current) {
      ctrlKPendingRef.current = false;
      // Ctrl+K, D → Format JSON
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        try {
          setContent(JSON.stringify(JSON.parse(content), null, 2));
        } catch { /* leave as-is */ }
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
      const lineText = lines[lineIdx] + (lineIdx < lines.length - 1 ? '\n' : '');
      navigator.clipboard.writeText(lineText).catch(() => {});
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
      const lineText = lines[lineIdx] + (lineIdx < lines.length - 1 ? '\n' : '');
      navigator.clipboard.writeText(lineText).catch(() => {});
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
      const trimmedEnd = currentLine.trimEnd();
      const extraIndent = (trimmedEnd.endsWith('{') || trimmedEnd.endsWith('[')) ? '  ' : '';
      const newValue = content.slice(0, pos) + '\n' + indent + extraIndent + content.slice(ta.selectionEnd);
      setContent(newValue);
      pendingCursorRef.current = pos + 1 + indent.length + extraIndent.length;
      return;
    }
  };

  // ── Parse JSON ─────────────────────────────
  const parsedResult = React.useMemo(() => {
    if (!content.trim()) return { valid: true, value: null as unknown };
    try { return { valid: true, value: JSON.parse(content) }; }
    catch { return { valid: false, value: null as unknown }; }
  }, [content]);

  // ── Highlighted HTML ───────────────────────
  const highlightedHtml = React.useMemo(() => highlightJson(content), [content]);

  // ── File name ─────────────────────────────
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // ── Tree expand / collapse all ─────────────
  const triggerCollapse = (collapsed: boolean) => {
    setTreeDefaultCollapsed(collapsed);
    setTreeKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="json-viewer">
        <div className="json-loading">{t('settings.selectingFolder')}</div>
      </div>
    );
  }

  return (
    <div className="json-viewer">

      {/* ── External change banner ─────────────── */}
      {externallyChanged && (
        <div className="json-external-banner">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{t('json.fileChangedExternally')}</span>
          <button
            className="json-btn json-btn-primary json-btn-sm"
            onClick={() => { setExternallyChanged(false); loadFile(filePath); }}
          >
            {t('json.reload')}
          </button>
          <button
            className="json-btn json-btn-ghost json-btn-sm"
            onClick={() => setExternallyChanged(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Toolbar ───────────────────────────── */}
      <div className="json-toolbar">
        <span className="json-toolbar-filename">
          <svg className="json-toolbar-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 2h9l3 3v9H2V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M11 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          {fileName}
        </span>

        {isDirty && <span className="json-dirty-dot" title={t('json.unsavedChanges')}>●</span>}

        <div className="json-toolbar-sep" />

        {/* View toggle */}
        <div className="json-view-toggle">
          <button
            className={`json-view-btn ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
            title={t('json.viewRaw')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('json.viewRaw')}
          </button>
          <button
            className={`json-view-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
            title={t('json.viewTree')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="6" y="7" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="11" y="2" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3 5v2.5H13V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M8 7V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {t('json.viewTree')}
          </button>
        </div>

        {viewMode === 'tree' && (
          <>
            <button className="json-btn" onClick={() => triggerCollapse(false)} title={t('json.expandAll')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 5l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('json.expandAll')}
            </button>
            <button className="json-btn" onClick={() => triggerCollapse(true)} title={t('json.collapseAll')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 11l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('json.collapseAll')}
            </button>
          </>
        )}

        <div className="json-toolbar-spacer" />

        {saveStatus === 'saved' && <span className="json-status json-status-ok">✓ {t('json.saved')}</span>}
        {saveStatus === 'error' && <span className="json-status json-status-err">{t('json.saveError')}</span>}

        {isDirty && (
          <>
            <button className="json-btn json-btn-ghost" onClick={handleRevert} title={t('json.revert')}>
              {t('json.revert')}
            </button>
            <button className="json-btn json-btn-primary" onClick={handleSave} title="Ctrl+S">
              {t('json.save')}
            </button>
          </>
        )}
      </div>

      {/* ── Raw view ──────────────────────────── */}
      {viewMode === 'raw' && (
        <div className="json-raw-scroller" ref={scrollerRef}>
          <div className="json-raw-content">
            <pre
              className="json-highlight-pre"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
            />
            <textarea
              ref={textareaRef}
              className="json-textarea"
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

      {/* ── Tree view ─────────────────────────── */}
      {viewMode === 'tree' && (
        <div className="json-tree-scroller">
          {!parsedResult.valid ? (
            <div className="json-parse-error">{t('json.parseError')}</div>
          ) : (
            <div className="json-tree-root" key={treeKey}>
              <JsonTreeNode
                value={parsedResult.value}
                depth={0}
                defaultCollapsed={treeDefaultCollapsed}
                path={[]}
                onValueChange={handleTreeValueChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JsonViewer;
