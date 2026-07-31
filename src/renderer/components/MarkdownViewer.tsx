import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { HotkeyMap, DEFAULT_HOTKEYS } from '../utils/settings';
import { matchesBinding } from '../utils/hotkeys';
import {
  renderMarkdownHtml,
  renderMermaidDiagrams,
  buildMarkdownPdfDocument,
} from '../utils/markdownPreview';
import './MarkdownViewer.css';

interface MarkdownViewerProps {
  filePath: string;
  hotkeys?: HotkeyMap;
  theme?: 'dark' | 'light';
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  filePath,
  hotkeys,
  theme = 'dark',
}) => {
  const { t } = useTranslation();
  const hk = hotkeys ?? DEFAULT_HOTKEYS;

  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [externallyChanged, setExternallyChanged] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ percent: number; stage: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  /** Only the user-driven pane may push scroll to the other side. */
  const scrollDriver = useRef<'editor' | 'preview' | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mermaidGen = useRef(0);
  const isDirty = content !== savedContent;
  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

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

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setSaveStatus('saving');
    const result = await window.electronAPI.writeMarkdownFile(filePath, content);
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

  const handleRevert = () => setContent(savedContent);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = content.slice(0, start) + '  ' + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const syncScrollRatio = (source: HTMLElement, target: HTMLElement | null) => {
    if (!target || syncingScroll.current) return;
    const sourceMax = source.scrollHeight - source.clientHeight;
    const targetMax = target.scrollHeight - target.clientHeight;
    if (sourceMax <= 0 || targetMax <= 0) return;
    syncingScroll.current = true;
    target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  };

  /** Push editor scroll → preview only (never the reverse). Used after preview re-renders. */
  const syncPreviewFromEditor = () => {
    const ta = textareaRef.current;
    if (!ta || !previewEnabled) return;
    syncScrollRatio(ta, previewRef.current);
  };

  const handleEditorScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    // Programmatic restores may leave driver as preview; only push when editor is driving.
    if (previewEnabled && scrollDriver.current !== 'preview') {
      scrollDriver.current = 'editor';
      syncScrollRatio(ta, previewRef.current);
    }
  };

  const handlePreviewScroll = () => {
    const preview = previewRef.current;
    if (!preview || !previewEnabled) return;
    if (scrollDriver.current !== 'preview') return;
    syncScrollRatio(preview, textareaRef.current);
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const previewHtml = useMemo(() => {
    try {
      return renderMarkdownHtml(content || '');
    } catch {
      return `<p class="md-preview-error">${t('markdown.parseError')}</p>`;
    }
  }, [content, t]);

  useEffect(() => {
    if (!previewEnabled || !previewRef.current) return;
    const root = previewRef.current;
    const editorScrollTop = textareaRef.current?.scrollTop ?? 0;
    const gen = ++mermaidGen.current;

    // Debounce while typing so height thrashing / reverse scroll sync cannot yank the editor.
    const timer = window.setTimeout(() => {
      if (gen !== mermaidGen.current || !previewRef.current) return;
      // Always reset HTML so theme switches re-create mermaid sources (not stale dark SVGs).
      previewRef.current.innerHTML = previewHtml;
      // Keep the editor where the user left it; only follow from editor → preview.
      if (textareaRef.current) {
        textareaRef.current.scrollTop = editorScrollTop;
        if (gutterRef.current) gutterRef.current.scrollTop = editorScrollTop;
      }
      syncPreviewFromEditor();

      void (async () => {
        if (gen !== mermaidGen.current || !previewRef.current) return;
        await renderMermaidDiagrams(previewRef.current, theme);
        if (gen !== mermaidGen.current) return;
        if (textareaRef.current) {
          textareaRef.current.scrollTop = editorScrollTop;
          if (gutterRef.current) gutterRef.current.scrollTop = editorScrollTop;
        }
        syncPreviewFromEditor();
      })();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [previewHtml, previewEnabled, theme]);

  const pdfStageLabel = (stage: string) => {
    switch (stage) {
      case 'dialog':
        return t('markdown.pdfStageDialog');
      case 'prepare':
        return t('markdown.pdfStagePrepare');
      case 'load':
        return t('markdown.pdfStageLoad');
      case 'layout':
        return t('markdown.pdfStageLayout');
      case 'render':
        return t('markdown.pdfStageRender');
      case 'save':
        return t('markdown.pdfStageSave');
      case 'done':
        return t('markdown.pdfStageDone');
      case 'preview':
        return t('markdown.pdfStagePreview');
      default:
        return t('markdown.exportingPdf');
    }
  };

  const handleExportPdf = async () => {
    if (!window.electronAPI?.exportHtmlToPdf) return;
    setExportingPdf(true);
    setPdfProgress({ percent: 2, stage: 'preview' });
    const unsubscribe = window.electronAPI.onExportPdfProgress?.((info) => {
      setPdfProgress(info);
    });
    try {
      setPdfProgress({ percent: 8, stage: 'preview' });
      // PDF always uses light mode; keep the on-screen preview on the UI theme.
      const exportRoot = document.createElement('div');
      exportRoot.style.cssText =
        'position:fixed;left:-99999px;top:0;width:800px;visibility:hidden;pointer-events:none;';
      exportRoot.innerHTML = previewHtml;
      document.body.appendChild(exportRoot);

      let result: { success: boolean; canceled?: boolean; error?: string; filePath?: string };
      try {
        await renderMermaidDiagrams(exportRoot, 'light');
        const html = buildMarkdownPdfDocument(fileName, exportRoot.innerHTML, 'light');
        result = await window.electronAPI.exportHtmlToPdf(html, fileName);
      } finally {
        exportRoot.remove();
      }
      if (result.canceled) return;
      if (result.success) {
        setPdfProgress({ percent: 100, stage: 'done' });
        setSaveStatus('saved');
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
        setPdfProgress(null);
        alert(result.error || t('markdown.saveError'));
        if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      }
    } finally {
      unsubscribe?.();
      setExportingPdf(false);
      setTimeout(() => setPdfProgress(null), 400);
    }
  };

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
  const lineCount = content.length === 0 ? 1 : content.split('\n').length;

  if (loading) {
    return (
      <div className="md-viewer">
        <div className="md-loading">{t('sidebar.loading')}</div>
      </div>
    );
  }

  return (
    <div className="md-viewer">
      {pdfProgress && (
        <div className="md-pdf-overlay" role="status" aria-live="polite">
          <div className="md-pdf-card">
            <div className="md-pdf-title">{t('markdown.exportingPdf')}</div>
            <div className="md-pdf-stage">{pdfStageLabel(pdfProgress.stage)}</div>
            <div className="md-pdf-bar">
              <div
                className="md-pdf-bar-fill"
                style={{ width: `${Math.max(0, Math.min(100, pdfProgress.percent))}%` }}
              />
            </div>
            <div className="md-pdf-percent">{Math.round(pdfProgress.percent)}%</div>
          </div>
        </div>
      )}
      {externallyChanged && (
        <div className="md-external-banner">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 5h1.5v4.5h-1.5V5zm0 6h1.5v1.5h-1.5V11z"
              fill="currentColor"
            />
          </svg>
          <span>{t('markdown.fileChangedExternally')}</span>
          <button
            type="button"
            className="md-btn md-btn-sm"
            onClick={() => {
              loadFile(filePath);
              setExternallyChanged(false);
            }}
          >
            {t('markdown.reload')}
          </button>
        </div>
      )}

      <div className="md-toolbar">
        <div className="md-toolbar-filename">
          <svg className="md-toolbar-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3 2.5A1.5 1.5 0 014.5 1h5.086a1.5 1.5 0 011.06.44l2.914 2.914a1.5 1.5 0 01.44 1.06V13.5A1.5 1.5 0 0112.5 15h-8A1.5 1.5 0 013 13.5v-11z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span>{fileName}</span>
          {isDirty && (
            <span className="md-dirty-dot" title={t('markdown.unsavedChanges')}>
              •
            </span>
          )}
        </div>

        <div className="md-toolbar-sep" />

        <button
          type="button"
          className={`md-btn ${previewEnabled ? 'active' : ''}`}
          onClick={() => setPreviewEnabled((v) => !v)}
          title={previewEnabled ? t('markdown.hidePreview') : t('markdown.showPreview')}
        >
          {previewEnabled ? t('markdown.hidePreview') : t('markdown.showPreview')}
        </button>
        <button
          type="button"
          className="md-btn"
          onClick={() => void handleExportPdf()}
          disabled={exportingPdf}
          title={t('markdown.exportPdf')}
        >
          {exportingPdf ? t('markdown.exportingPdf') : t('markdown.exportPdf')}
        </button>

        <div className="md-toolbar-spacer" />

        {saveStatus === 'saved' && <span className="md-save-status ok">{t('markdown.saved')}</span>}
        {saveStatus === 'error' && <span className="md-save-status err">{t('markdown.saveError')}</span>}

        {isDirty && (
          <button type="button" className="md-btn" onClick={handleRevert}>
            {t('markdown.revert')}
          </button>
        )}
        <button
          type="button"
          className="md-btn md-btn-primary"
          onClick={() => void handleSave()}
          disabled={!isDirty || saveStatus === 'saving'}
        >
          {t('markdown.save')}
        </button>
      </div>

      <div className={`md-body ${previewEnabled ? 'split' : 'edit-only'}`}>
        <div className="md-editor-pane">
          <div className="md-editor-layout">
            <div className="md-gutter" ref={gutterRef} aria-hidden>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="md-gutter-line">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="md-editor"
              value={content}
              spellCheck={false}
              onChange={(e) => {
                scrollDriver.current = 'editor';
                setContent(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onScroll={handleEditorScroll}
              onFocus={() => {
                scrollDriver.current = 'editor';
              }}
              onPointerDown={() => {
                scrollDriver.current = 'editor';
              }}
              onWheel={() => {
                scrollDriver.current = 'editor';
              }}
              aria-label={t('markdown.editor')}
            />
          </div>
        </div>

        {previewEnabled && (
          <>
            <div className="md-split-resizer" aria-hidden />
            <div className="md-preview-pane">
              <div
                key={`md-preview-${theme}`}
                ref={previewRef}
                className="md-preview"
                onScroll={handlePreviewScroll}
                onPointerDown={() => {
                  scrollDriver.current = 'preview';
                }}
                onWheel={() => {
                  scrollDriver.current = 'preview';
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MarkdownViewer;
