import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { highlightXml } from '../utils/xmlHighlighter';
import { formatXml } from '../utils/xmlFormatter';
import { HotkeyMap, DEFAULT_HOTKEYS } from '../utils/settings';
import { isChordStarter, matchesBinding } from '../utils/hotkeys';
import {
  childNodeKey,
  getStructuredViewerUi,
  setStructuredViewerUi,
  StructuredViewMode,
} from '../utils/viewerUiState';
import './XmlViewer.css';

interface XmlViewerProps {
  filePath: string;
  hotkeys?: HotkeyMap;
  tabId?: string;
}

type XmlValueKind = 'text' | 'bool' | 'number' | 'path';

function getXmlValueKind(value: string): XmlValueKind {
  const v = value.trim();
  if (/^(true|false)$/i.test(v)) return 'bool';
  if (/^-?\d+(?:[.,]\d+)?$/.test(v)) return 'number';
  if (/^[a-zA-Z]:\\|\\|\/|\.[a-zA-Z0-9]+$/.test(v) || /[\\/]/.test(v)) return 'path';
  return 'text';
}

function getElementChildren(el: Element): ChildNode[] {
  return Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.COMMENT_NODE
  );
}

function collectXmlExpandableKeys(node: Node, key: string): string[] {
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const children = getElementChildren(el);
  if (children.length === 0) return [];
  const keys = [key];
  children.forEach((child, i) => {
    keys.push(...collectXmlExpandableKeys(child, childNodeKey(key, i)));
  });
  return keys;
}

// ─────────────────────────────────────────────
// XML Tree Node (recursive)
// ─────────────────────────────────────────────

interface XmlTreeNodeProps {
  node: Node;
  depth: number;
  nodeKey: string;
  collapsedPaths: Set<string>;
  onToggleCollapse: (key: string) => void;
  xmlDoc?: Document;
  onContentChange?: (xml: string) => void;
}

const XmlTreeNode: React.FC<XmlTreeNodeProps> = ({
  node,
  depth,
  nodeKey,
  collapsedPaths,
  onToggleCollapse,
  xmlDoc,
  onContentChange,
}) => {
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
  const elementChildren = getElementChildren(el);
  const hasChildren = elementChildren.length > 0;
  const collapsed = collapsedPaths.has(nodeKey);

  // Find a direct text node for leaf elements
  const textDomNodes = Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()
  );
  const inlineText =
    !hasChildren && textDomNodes.length > 0
      ? textDomNodes.map((n) => n.textContent?.trim()).filter(Boolean).join(' ')
      : '';
  const inlineValueKind = getXmlValueKind(inlineText);
  const editInputWidthCh = Math.min(Math.max(editValue.length + 4, 24), 120);
  const textDomNode = textDomNodes[0] ?? null;
  const canEdit = !!onContentChange && !hasChildren;

  const startEdit = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    setEditValue(inlineText);
    setIsEditing(true);
  };

  const commitEdit = () => {
    if (!xmlDoc || !onContentChange) {
      setIsEditing(false);
      return;
    }

    const existingTextNode = Array.from(el.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE
    ) as ChildNode | undefined;
    const nextValue = editValue;

    if (existingTextNode) {
      if (nextValue === '') {
        el.removeChild(existingTextNode);
      } else {
        existingTextNode.textContent = nextValue;
      }
    } else if (nextValue !== '') {
      el.appendChild(xmlDoc.createTextNode(nextValue));
    }

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
        onClick={() => hasChildren && onToggleCollapse(nodeKey)}
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
        {attrs.map((attr) => {
          const attrValueKind = getXmlValueKind(attr.value);
          return (
            <span key={attr.name} className="xml-tree-attr">
              <span className="xml-tree-attr-name">{attr.name}</span>
              <span className="xml-tree-attr-eq">=</span>
              <span className={`xml-tree-attr-val xml-tree-value xml-tree-value-${attrValueKind}`}>&quot;{attr.value}&quot;</span>
            </span>
          );
        })}

        {/* Inline value — editable leaf */}
        {inlineText && !isEditing && (
          <span
            className={`xml-tree-text-inline xml-tree-value xml-tree-value-${inlineValueKind} ${canEdit ? 'xml-tree-editable' : ''}`}
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
            style={{ width: `${editInputWidthCh}ch` }}
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
          <span
            className={`xml-tree-empty ${canEdit ? 'xml-tree-editable' : ''}`}
            onClick={startEdit}
            title={canEdit ? 'Click to edit' : undefined}
          >
            /
          </span>
        )}
      </div>
      {hasChildren && !collapsed && (
        <div className="xml-tree-children">
          {elementChildren.map((child, i) => (
            <XmlTreeNode
              key={i}
              node={child}
              depth={depth + 1}
              nodeKey={childNodeKey(nodeKey, i)}
              collapsedPaths={collapsedPaths}
              onToggleCollapse={onToggleCollapse}
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
// Code-Folding helpers
// ─────────────────────────────────────────────

const FOLD_MARKER_PREFIX = '<!-- §FOLD_BLOCK:';

/** Replace all fold placeholders with their original lines. */
function expandAllFolds(text: string, foldMap: Map<number, string[]>): string {
  if (foldMap.size === 0) return text;
  const lines = text.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const match = line.match(/<!-- §FOLD_BLOCK:(\d+)§/);
    if (match) {
      const original = foldMap.get(Number(match[1]));
      if (original) { result.push(...original); continue; }
    }
    result.push(line);
  }
  return result.join('\n');
}

/** Find XML tag regions that can be folded (start line → { end, tagName }). */
function findFoldableRegions(lines: string[]): Map<number, { end: number; tagName: string }> {
  const result = new Map<number, { end: number; tagName: string }>();
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Skip blank, comments, PIs, declarations, closing tags, fold placeholders
    if (!trimmed || !trimmed.startsWith('<')) continue;
    if (trimmed.startsWith('<!--') || trimmed.startsWith('<?') ||
        trimmed.startsWith('<!') || trimmed.startsWith('</')) continue;
    if (trimmed.endsWith('/>')) continue; // self-closing
    if (!trimmed.endsWith('>')) continue; // multi-line opening tag (not supported)
    const tagMatch = trimmed.match(/^<([a-zA-Z_][\w:.-]*)/);
    if (!tagMatch) continue;
    const tagName = tagMatch[1];
    // Exclude one-liners like <tag>text</tag>
    if (trimmed.includes(`</${tagName}>`)) continue;
    // Find matching closing tag
    let depth = 1;
    for (let j = i + 1; j < lines.length; j++) {
      const jt = lines[j];
      const opens = (jt.match(new RegExp(`<${tagName}(?:[\\s>])`, 'g')) ?? []).length
                  - (jt.match(new RegExp(`<${tagName}[^>]*/>`, 'g')) ?? []).length;
      const closes = (jt.match(new RegExp(`</${tagName}>`, 'g')) ?? []).length;
      depth += opens - closes;
      if (depth <= 0) {
        if (j > i + 1) result.set(i, { end: j, tagName });
        break;
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Main XmlViewer component
// ─────────────────────────────────────────────

const XmlViewer: React.FC<XmlViewerProps> = ({ filePath, hotkeys, tabId }) => {
  const { t } = useTranslation();
  const hk = hotkeys ?? DEFAULT_HOTKEYS;
  const savedUi = tabId ? getStructuredViewerUi(tabId) : undefined;
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [viewMode, setViewMode] = useState<StructuredViewMode>(savedUi?.viewMode ?? 'raw');
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set(savedUi?.collapsedPaths ?? [])
  );
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [currentLine, setCurrentLine] = useState(1);
  const [foldMap, setFoldMap] = useState<Map<number, string[]>>(new Map());
  const foldIdRef = useRef(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  const updateCurrentLine = useCallback(() => {
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      setCurrentLine(ta.value.slice(0, ta.selectionStart).split('\n').length);
    });
  }, []);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [externallyChanged, setExternallyChanged] = useState(false);

  const isDirty = foldMap.size === 0
    ? content !== savedContent
    : expandAllFolds(content, foldMap) !== savedContent;

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
    setFoldMap(new Map());
    foldIdRef.current = 0;
    setCurrentLine(1);
    loadFile(filePath).finally(() => setLoading(false));
  }, [filePath, loadFile]);  // eslint-disable-line react-hooks/exhaustive-deps

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
    const contentToSave = expandAllFolds(content, foldMap);
    const result = await window.electronAPI.writeXmlFile(filePath, contentToSave);
    if (result.success) {
      setSavedContent(contentToSave);
      setSaveStatus('saved');
      setExternallyChanged(false);
    } else {
      setSaveStatus('error');
    }
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
  }, [filePath, content, foldMap, isDirty]);

  // Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, hk.save)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, hk]);

  // ── Revert ─────────────────────────────────
  const handleRevert = () => {
    setContent(savedContent);
    setFoldMap(new Map());
    foldIdRef.current = 0;
  };

  // ── Fold / Unfold ───────────────────────────
  const foldRegion = useCallback((start: number, end: number, tagName: string) => {
    const lines = content.split('\n');
    const id = ++foldIdRef.current;
    const originalLines = lines.slice(start, end + 1);
    const indent = lines[start].match(/^(\s*)/)?.[1] ?? '';
    const placeholder = `${indent}${FOLD_MARKER_PREFIX}${id}§ <${tagName}> (${end - start + 1} lines) -->`;
    const newLines = [...lines.slice(0, start), placeholder, ...lines.slice(end + 1)];
    const newLineStart = newLines.slice(0, start).reduce((sum, line) => sum + line.length + 1, 0);
    const newContent = newLines.join('\n');
    setFoldMap(prev => { const n = new Map(prev); n.set(id, originalLines); return n; });
    setContent(newContent);
    pendingCursorRef.current = Math.min(newLineStart, newContent.length);
    setCurrentLine(start + 1);
  }, [content]);

  const unfoldLine = useCallback((lineIndex: number, foldId: number) => {
    const original = foldMap.get(foldId);
    if (!original) return;
    const lines = content.split('\n');
    const newLines = [...lines.slice(0, lineIndex), ...original, ...lines.slice(lineIndex + 1)];
    const newLineStart = newLines.slice(0, lineIndex).reduce((sum, line) => sum + line.length + 1, 0);
    const newContent = newLines.join('\n');
    setFoldMap(prev => { const n = new Map(prev); n.delete(foldId); return n; });
    setContent(newContent);
    pendingCursorRef.current = Math.min(newLineStart, newContent.length);
    setCurrentLine(lineIndex + 1);
  }, [content, foldMap]);

  // Track Ctrl+K chord
  const ctrlKPendingRef = useRef(false);

  // ── Textarea key handler ───────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;

    // ── Alt+Up: move line up ─────────────────
    if (matchesBinding(e, hk.moveLineUp)) {
      e.preventDefault();
      const lines = content.split('\n');
      const pos = ta.selectionStart;
      let charCount = 0;
      let lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = charCount + lines[i].length;
        if (pos <= lineEnd) { lineIdx = i; break; }
        charCount += lines[i].length + 1;
      }
      if (lineIdx > 0) {
        const newLines = [...lines];
        [newLines[lineIdx], newLines[lineIdx - 1]] = [newLines[lineIdx - 1], newLines[lineIdx]];
        const newContent = newLines.join('\n');
        setContent(newContent);
        let newCharCount = 0;
        for (let i = 0; i < lineIdx - 1; i++) newCharCount += newLines[i].length + 1;
        pendingCursorRef.current = Math.min(newCharCount + (pos - charCount), newCharCount + newLines[lineIdx - 1].length);
      }
      return;
    }

    // ── Alt+Down: move line down ─────────────
    if (matchesBinding(e, hk.moveLineDown)) {
      e.preventDefault();
      const lines = content.split('\n');
      const pos = ta.selectionStart;
      let charCount = 0;
      let lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = charCount + lines[i].length;
        if (pos <= lineEnd) { lineIdx = i; break; }
        charCount += lines[i].length + 1;
      }
      if (lineIdx < lines.length - 1) {
        const newLines = [...lines];
        [newLines[lineIdx], newLines[lineIdx + 1]] = [newLines[lineIdx + 1], newLines[lineIdx]];
        const newContent = newLines.join('\n');
        setContent(newContent);
        let newCharCount = 0;
        for (let i = 0; i < lineIdx + 1; i++) newCharCount += newLines[i].length + 1;
        pendingCursorRef.current = Math.min(newCharCount + (pos - charCount), newCharCount + newLines[lineIdx + 1].length);
      }
      return;
    }

    // ── Ctrl+K chord handling ────────────────
    if (isChordStarter(e)) {
      e.preventDefault();
      ctrlKPendingRef.current = true;
      return;
    }
    if (ctrlKPendingRef.current) {
      ctrlKPendingRef.current = false;

      if (matchesBinding(e, hk.format, { chordPending: true })) {
        e.preventDefault();
        try {
          setContent(formatXml(content));
        } catch {
          // leave as-is if XML is invalid
        }
        return;
      }

      if (matchesBinding(e, hk.comment, { chordPending: true })) {
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

      if (matchesBinding(e, hk.uncomment, { chordPending: true })) {
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
    if (matchesBinding(e, hk.cutLine)) {
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
  const xmlSourceForTree = useMemo(() => expandAllFolds(content, foldMap), [content, foldMap]);

  const xmlDoc = React.useMemo(() => {
    if (!xmlSourceForTree) return null;
    try {
      const parser = new DOMParser();
      return parser.parseFromString(xmlSourceForTree, 'text/xml');
    } catch {
      return null;
    }
  }, [xmlSourceForTree]);

  const parseError = xmlDoc?.querySelector('parsererror');
  const rootElement = !parseError ? xmlDoc?.documentElement ?? null : null;

  // ── Lines + fold analysis ──────────────────
  const contentLines = useMemo(() => content.split('\n'), [content]);
  const foldableRegions = useMemo(() => findFoldableRegions(contentLines), [contentLines]);
  const foldedLines = useMemo(() => {
    const map = new Map<number, number>();
    contentLines.forEach((line, i) => {
      const m = line.match(/<!-- §FOLD_BLOCK:(\d+)§/);
      if (m) map.set(i, Number(m[1]));
    });
    return map;
  }, [contentLines]);

  const foldControls = useMemo(() => {
    const controls: Array<
      | { lineIndex: number; indent: number; mode: 'fold'; end: number; tagName: string }
      | { lineIndex: number; indent: number; mode: 'unfold'; foldId: number }
    > = [];

    contentLines.forEach((line, lineIndex) => {
      const foldable = foldableRegions.get(lineIndex);
      const foldedId = foldedLines.get(lineIndex);
      if (foldable && foldedId === undefined) {
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        controls.push({ lineIndex, indent, mode: 'fold', end: foldable.end, tagName: foldable.tagName });
      } else if (foldedId !== undefined) {
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        controls.push({ lineIndex, indent, mode: 'unfold', foldId: foldedId });
      }
    });

    return controls;
  }, [contentLines, foldableRegions, foldedLines]);

  // Keep highlighted line within valid range after fold/unfold or external updates.
  useEffect(() => {
    const maxLine = Math.max(contentLines.length, 1);
    if (currentLine > maxLine) {
      setCurrentLine(maxLine);
    } else if (currentLine < 1) {
      setCurrentLine(1);
    }
  }, [contentLines.length, currentLine]);

  // ── Highlighted HTML ───────────────────────
  const highlightedHtml = React.useMemo(() => highlightXml(content), [content]);

  // ── File name for display ──────────────────
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // ── Persist view mode + tree folds per tab ─
  useEffect(() => {
    if (!tabId) return;
    setStructuredViewerUi(tabId, {
      viewMode,
      collapsedPaths: [...collapsedPaths],
    });
  }, [tabId, viewMode, collapsedPaths]);

  const handleToggleCollapse = useCallback((key: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Tree expand / collapse all ─────────────
  const expandAll = () => setCollapsedPaths(new Set());
  const collapseAll = () => {
    if (!rootElement) return;
    setCollapsedPaths(new Set(collectXmlExpandableKeys(rootElement, '0')));
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
            <button className="xml-btn" onClick={expandAll} title={t('xml.expandAll')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 5l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t('xml.expandAll')}
            </button>
            <button className="xml-btn" onClick={collapseAll} title={t('xml.collapseAll')}>
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
          <div className="xml-editor-layout">
            <div className="xml-line-gutter">
              {contentLines.map((_, i) => {
                const isActive = i + 1 === currentLine;
                return (
                  <div key={i} className={`xml-gutter-line${isActive ? ' active' : ''}`}>
                    <span className="xml-gutter-number">{i + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="xml-raw-content">
              <div className="xml-fold-controls" aria-hidden="true">
                {foldControls.map((control) => (
                  <button
                    key={`${control.mode}-${control.lineIndex}`}
                    className={`xml-fold-btn xml-fold-btn-inline${control.mode === 'unfold' ? ' xml-fold-btn-collapsed' : ''}`}
                    title={control.mode === 'fold' ? `<${control.tagName}> einklappen` : 'Ausklappen'}
                    style={{
                      top: `calc(14px + ${control.lineIndex} * 1.5589rem)`,
                      left: `calc(20px + ${control.indent}ch - 18px)`,
                    }}
                    onClick={() => {
                      if (control.mode === 'fold') {
                        foldRegion(control.lineIndex, control.end, control.tagName);
                      } else {
                        unfoldLine(control.lineIndex, control.foldId);
                      }
                    }}
                  >
                    {control.mode === 'fold' ? '▾' : '▸'}
                  </button>
                ))}
              </div>
              <div
                className="xml-line-highlight-bar"
                style={{ top: `calc(14px + ${currentLine - 1} * 1.5589rem)` }}
              />
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
                onSelect={updateCurrentLine}
                onClick={updateCurrentLine}
                onKeyUp={updateCurrentLine}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>
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
            <div className="xml-tree-root">
              {/* Declaration comment if present */}
              {xmlSourceForTree.startsWith('<?xml') && (
                <div className="xml-tree-decl">
                  {xmlSourceForTree.match(/^<\?xml[^?]*\?>/)?.[0] ?? '<?xml version="1.0"?>'}
                </div>
              )}
              <XmlTreeNode
                node={rootElement}
                depth={0}
                nodeKey="0"
                collapsedPaths={collapsedPaths}
                onToggleCollapse={handleToggleCollapse}
                xmlDoc={xmlDoc ?? undefined}
                onContentChange={(newXml) => {
                  setContent(newXml);
                  setFoldMap(new Map());
                  foldIdRef.current = 0;
                }}
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
