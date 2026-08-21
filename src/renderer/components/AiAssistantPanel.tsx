import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
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

interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  model: string;
  baseUrl: string;
  seed?: AiSeedContext | null;
  onSeedConsumed?: () => void;
}

const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  open,
  onClose,
  model,
  baseUrl,
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
  const listRef = useRef<HTMLDivElement>(null);
  const pendingSeed = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!window.electronAPI?.ollamaStatus) return;
    const s = await window.electronAPI.ollamaStatus(baseUrl);
    setStatus(s);
  }, [baseUrl]);

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    if (!open || !seed?.prompt) return;
    pendingSeed.current = seed.prompt;
    onSeedConsumed?.();
  }, [seed, open, onSeedConsumed]);

  useEffect(() => {
    if (!open || !pendingSeed.current) return;
    if (!status?.running) return;
    const prompt = pendingSeed.current;
    pendingSeed.current = null;
    void sendPrompt(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status?.running]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const ensureModel = async (): Promise<boolean> => {
    const s = await window.electronAPI.ollamaStatus(baseUrl);
    setStatus(s);
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
    const hasModel = again.models.some((m) => m === model || m.startsWith(`${model}:`) || m.startsWith(model.split(':')[0]));
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
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: t('ai.setupNeeded') } : m
        )
      );
      setBusy(false);
      return;
    }

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const requestId = `req-${Date.now()}`;
    const unsub = window.electronAPI.onOllamaChatToken?.((info) => {
      if (info.requestId !== requestId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + info.token } : m
        )
      );
    });

    const result = await window.electronAPI.ollamaChat({
      model,
      baseUrl,
      requestId,
      messages: history,
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
        prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: result.content! } : m))
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
                setPullInfo(t('ai.installing'));
                const res = await window.electronAPI.ollamaInstall();
                setPullInfo(res.message);
                await refreshStatus();
                setBusy(false);
              }}
            >
              {t('ai.install')}
            </button>
            <button
              type="button"
              className="ai-btn"
              onClick={() => void window.electronAPI.ollamaOpenDownload()}
            >
              {t('ai.openDownload')}
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
        {messages.length === 0 && (
          <div className="ai-empty">{t('ai.empty')}</div>
        )}
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
    'Bitte erkläre diesen Log-Eintrag und schlage mögliche Ursachen sowie nächste Checks vor:',
    '',
    `Timestamp: ${entry.timestamp}`,
    `Level: ${entry.level}`,
    `Namespace: ${entry.namespace}`,
    `Message: ${entry.message}`,
    '',
    'Raw:',
    entry.fullText,
  ].join('\n');
}
