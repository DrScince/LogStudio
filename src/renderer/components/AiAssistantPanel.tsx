import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import { buildLogFileExcerpt, fileLabelFromPath } from '../utils/aiLogContext';
import './AiAssistantPanel.css';

export type AiSeedContext = {
  title?: string;
  prompt: string;
};

type ChatRole = 'user' | 'assistant';

type UiMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type FileContextState = {
  fileName: string;
  excerpt: string;
  note: string;
  truncated: boolean;
  lineCount: number;
  totalLines: number;
} | null;

interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  model: string;
  baseUrl: string;
  filePath?: string | null;
  filePaths?: string[] | null;
  seed?: AiSeedContext | null;
  onSeedConsumed?: () => void;
}

const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  open,
  onClose,
  model,
  baseUrl,
  filePath,
  filePaths,
  seed,
  onSeedConsumed,
}) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<{
    installed: boolean;
    running: boolean;
    models: string[];
    version?: string;
    error?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pullInfo, setPullInfo] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [fileContext, setFileContext] = useState<FileContextState>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingSeed = useRef<string | null>(null);
  const fileContextRef = useRef<FileContextState>(null);
  const installerLaunchedRef = useRef(false);

  useEffect(() => {
    fileContextRef.current = fileContext;
  }, [fileContext]);

  const activePaths = (filePaths && filePaths.length > 0
    ? filePaths
    : filePath
      ? [filePath]
      : []
  ).filter(Boolean) as string[];

  const refreshStatus = useCallback(async () => {
    if (!window.electronAPI?.ollamaStatus) return;
    const s = await window.electronAPI.ollamaStatus(baseUrl);
    setStatus(s);
  }, [baseUrl]);

  const loadFileContext = useCallback(async (): Promise<FileContextState> => {
    if (!window.electronAPI?.readLogFile || activePaths.length === 0) {
      setFileContext(null);
      fileContextRef.current = null;
      return null;
    }
    setContextLoading(true);
    try {
      const parts: string[] = [];
      let totalLines = 0;
      const labels: string[] = [];
      const perFileBudget = activePaths.length > 1 ? 12000 : 24000;
      for (const path of activePaths.slice(0, 5)) {
        const result = await window.electronAPI.readLogFile(path);
        if (!result.success || result.content == null) continue;
        const built = buildLogFileExcerpt(result.content, perFileBudget);
        const label = fileLabelFromPath(path);
        labels.push(label);
        totalLines += built.totalLines;
        parts.push(
          activePaths.length > 1
            ? `### File: ${label}\n${built.excerpt}`
            : built.excerpt
        );
      }
      if (parts.length === 0) {
        setFileContext(null);
        fileContextRef.current = null;
        return null;
      }
      const combined = parts.join('\n\n');
      const final = buildLogFileExcerpt(combined, 28000);
      const truncated = final.truncated || parts.length < activePaths.length;
      const next: FileContextState = {
        fileName: labels.join(', '),
        excerpt: final.excerpt,
        truncated,
        lineCount: final.lineCount,
        totalLines,
        note: truncated
          ? `Excerpt of the currently open log file(s). Showing the most recent ~${final.lineCount} lines of ${totalLines} total.`
          : `Full content of the currently open log file(s) (${totalLines} lines).`,
      };
      setFileContext(next);
      fileContextRef.current = next;
      return next;
    } finally {
      setContextLoading(false);
    }
  }, [activePaths.join('|')]);

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
  }, [open, refreshStatus]);

  // On first AI use: if Ollama is missing, launch the official installer.
  useEffect(() => {
    if (!open || !status || status.installed || status.running) return;
    if (installerLaunchedRef.current) return;
    installerLaunchedRef.current = true;
    void (async () => {
      setPullInfo(t('ai.launchingInstaller'));
      const res = await window.electronAPI.ollamaInstall();
      setPullInfo(res.message || t('ai.installerLaunched'));
      await refreshStatus();
    })();
  }, [open, status, refreshStatus, t]);

  useEffect(() => {
    if (!open) return;
    void loadFileContext();
  }, [open, loadFileContext]);

  useEffect(() => {
    if (!open || !seed?.prompt) return;
    pendingSeed.current = seed.prompt;
    onSeedConsumed?.();
  }, [seed, open, onSeedConsumed]);

  useEffect(() => {
    if (!open || !pendingSeed.current) return;
    if (!status?.running) return;
    // Wait until context finished loading (or there is no file).
    if (contextLoading) return;
    const prompt = pendingSeed.current;
    pendingSeed.current = null;
    void sendPrompt(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status?.running, contextLoading, fileContext]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const ensureModel = async (): Promise<boolean> => {
    const s = await window.electronAPI.ollamaStatus(baseUrl);
    setStatus(s);
    if (!s.installed && !s.running) {
      setPullInfo(t('ai.launchingInstaller'));
      const res = await window.electronAPI.ollamaInstall();
      setPullInfo(res.message || t('ai.installerLaunched'));
      await refreshStatus();
      return false;
    }
    if (!s.running) {
      const started = await window.electronAPI.ollamaEnsureRunning(baseUrl);
      if (!started.success) {
        setPullInfo(t('ai.notRunning'));
        await refreshStatus();
        return false;
      }
    }
    const again = await window.electronAPI.ollamaStatus(baseUrl);
    setStatus(again);
    const hasModel = again.models.some(
      (m) => m === model || m.startsWith(`${model}:`) || m.startsWith(model.split(':')[0])
    );
    if (hasModel) return true;

    setPullInfo(t('ai.pulling', { model }));
    const unsub = window.electronAPI.onOllamaPullProgress?.((info) => {
      const pct = info.percent != null ? ` ${info.percent}%` : '';
      setPullInfo(`${info.status}${pct}`);
    });
    const result = await window.electronAPI.ollamaPullModel(model, baseUrl);
    unsub?.();
    if (!result.success) {
      setPullInfo(result.error || t('ai.pullFailed'));
      return false;
    }
    setPullInfo(null);
    await refreshStatus();
    return true;
  };

  const sendPrompt = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput('');
    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);

    const ok = await ensureModel();
    if (!ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: t('ai.setupNeeded') } : m))
      );
      setBusy(false);
      return;
    }

    // Refresh context right before asking so live log updates are included.
    const ctx = await loadFileContext();

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const requestId = `req-${Date.now()}`;
    const unsub = window.electronAPI.onOllamaChatToken?.((info) => {
      if (info.requestId !== requestId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + info.token } : m))
      );
    });

    const result = await window.electronAPI.ollamaChat({
      model,
      baseUrl,
      requestId,
      messages: history,
      fileContext: ctx
        ? { fileName: ctx.fileName, excerpt: ctx.excerpt, note: ctx.note }
        : undefined,
    });
    unsub?.();

    if (!result.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || result.error || t('ai.chatFailed') }
            : m
        )
      );
    } else if (result.content) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content ? { ...m, content: result.content! } : m
        )
      );
    }
    setBusy(false);
    setPullInfo(null);
  };

  if (!open) return null;

  const modelReady =
    !!status?.running &&
    status.models.some(
      (m) => m === model || m.startsWith(`${model.split(':')[0]}:`) || m.startsWith(model)
    );

  return (
    <aside className="ai-panel" aria-label={t('ai.title')}>
      <div className="ai-panel-header">
        <div>
          <div className="ai-panel-title">{t('ai.title')}</div>
          <div className="ai-panel-subtitle">{t('ai.subtitle', { model })}</div>
        </div>
        <button type="button" className="ai-panel-close" onClick={onClose} aria-label={t('settings.cancel')}>
          ×
        </button>
      </div>

      <div className="ai-panel-status">
        <span className={`ai-dot ${status?.running ? 'ok' : 'bad'}`} />
        <span>
          {status?.running
            ? t('ai.statusRunning', { version: status.version || 'OK' })
            : t('ai.statusOffline')}
        </span>
        <button type="button" className="ai-mini-btn" onClick={() => void refreshStatus()} disabled={busy}>
          {t('ai.refresh')}
        </button>
      </div>

      <div className={`ai-context ${fileContext ? 'ok' : 'missing'}`}>
        {contextLoading ? (
          <span>{t('ai.contextLoading')}</span>
        ) : fileContext ? (
          <span>
            {t('ai.contextAttached', {
              file: fileContext.fileName,
              lines: String(fileContext.lineCount),
              total: String(fileContext.totalLines),
            })}
            {fileContext.truncated ? ` · ${t('ai.contextTruncated')}` : ''}
          </span>
        ) : (
          <span>{t('ai.contextMissing')}</span>
        )}
        <button
          type="button"
          className="ai-mini-btn"
          onClick={() => void loadFileContext()}
          disabled={busy || contextLoading || activePaths.length === 0}
        >
          {t('ai.contextReload')}
        </button>
      </div>

      {!status?.running && (
        <div className="ai-setup">
          <p>{t('ai.installHint')}</p>
          <div className="ai-setup-actions">
            <button
              type="button"
              className="ai-btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setPullInfo(t('ai.launchingInstaller'));
                const res = await window.electronAPI.ollamaInstall();
                setPullInfo(res.message || t('ai.installerLaunched'));
                await refreshStatus();
                setBusy(false);
              }}
            >
              {t('ai.install')}
            </button>
            <button
              type="button"
              className="ai-btn"
              onClick={() => void refreshStatus()}
            >
              {t('ai.refresh')}
            </button>
          </div>
        </div>
      )}

      {status?.running && !modelReady && (
        <div className="ai-setup">
          <p>{t('ai.modelMissing', { model })}</p>
          <button
            type="button"
            className="ai-btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await ensureModel();
              setBusy(false);
            }}
          >
            {t('ai.downloadModel')}
          </button>
        </div>
      )}

      {pullInfo && <div className="ai-pull-info">{pullInfo}</div>}

      <div className="ai-messages" ref={listRef}>
        {messages.length === 0 && <div className="ai-empty">{t('ai.empty')}</div>}
        {messages.map((m) => (
          <div key={m.id} className={`ai-msg ${m.role}`}>
            <div className="ai-msg-role">{m.role === 'user' ? t('ai.you') : t('ai.assistant')}</div>
            <div className="ai-msg-body">{m.content || (busy ? '…' : '')}</div>
          </div>
        ))}
      </div>

      <form
        className="ai-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void sendPrompt(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('ai.placeholder')}
          rows={3}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendPrompt(input);
            }
          }}
        />
        <button type="submit" className="ai-btn primary" disabled={busy || !input.trim()}>
          {busy ? t('ai.thinking') : t('ai.send')}
        </button>
      </form>
    </aside>
  );
};

export default AiAssistantPanel;

export function buildAskPromptFromLog(entry: {
  timestamp: string;
  level: string;
  namespace: string;
  message: string;
  fullText: string;
}): string {
  return [
    'Bitte erkläre diesen Log-Eintrag im Kontext der aktuell geöffneten Log-Datei und schlage mögliche Ursachen sowie nächste Checks vor:',
    '',
    `Timestamp: ${entry.timestamp}`,
    `Level: ${entry.level}`,
    `Namespace: ${entry.namespace}`,
    `Message: ${entry.message}`,
    '',
    'Raw entry:',
    entry.fullText,
  ].join('\n');
}
