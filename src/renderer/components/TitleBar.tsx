import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from '../i18n';
import { Workspace } from '../utils/workspaces';
import './TitleBar.css';

interface TitleBarProps {
  onSettingsClick: () => void;
  onAboutClick: () => void;
  onThemeToggle: () => void;
  onCheckForUpdates: () => void;
  onAiClick?: () => void;
  currentTheme: 'dark' | 'light';
  checkingForUpdates: boolean;
  updateAvailable: boolean;
  aiActive?: boolean;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  onWorkspaceSwitch?: (id: string) => void;
  onWorkspaceCreate?: () => void;
  onWorkspaceRename?: (id: string, name: string) => void;
  onWorkspaceDelete?: (id: string) => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  onSettingsClick,
  onAboutClick,
  onThemeToggle,
  onCheckForUpdates,
  onAiClick,
  currentTheme,
  checkingForUpdates,
  updateAvailable,
  aiActive,
  workspaces = [],
  activeWorkspaceId = '',
  onWorkspaceSwitch,
  onWorkspaceCreate,
  onWorkspaceRename,
  onWorkspaceDelete,
}) => {
  const { t } = useTranslation();
  const [wsOpen, setWsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const wsBtnRef = useRef<HTMLButtonElement>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    if (!wsOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wsBtnRef.current?.contains(target)) return;
      if (wsMenuRef.current?.contains(target)) return;
      setWsOpen(false);
      setRenamingId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [wsOpen]);

  const toggleWorkspaceMenu = () => {
    if (!wsOpen && wsBtnRef.current) {
      const rect = wsBtnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setWsOpen((open) => !open);
    setRenamingId(null);
  };

  const startRename = (id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    setRenamingId(id);
    setRenameValue(ws?.name ?? '');
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onWorkspaceRename?.(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleMinimize = () => { if (window.electronAPI) window.electronAPI.minimizeWindow(); };
  const handleMaximize = () => { if (window.electronAPI) window.electronAPI.maximizeWindow(); };
  const handleClose = () => { if (window.electronAPI) window.electronAPI.closeWindow(); };

  return (
    <div className="title-bar">
      <div className="title-bar-drag-region">
        <div className="title-bar-icon">
          <img src="LogStudio_Logo.png" alt="LogStudio" />
        </div>
        <div className="title-bar-title">LogStudio</div>
      </div>

      <div className="title-bar-actions">
        <div className="title-bar-sep" />

        <button className="title-bar-action" onClick={onSettingsClick} title={t('titlebar.settings')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {onAiClick && (
          <button
            className={`title-bar-action${aiActive ? ' active' : ''}`}
            onClick={onAiClick}
            title={t('titlebar.aiAssistant')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <button className="title-bar-action" onClick={onThemeToggle} title={currentTheme === 'dark' ? t('titlebar.switchToLight') : t('titlebar.switchToDark')}>
          {currentTheme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {!updateAvailable && (
          <button
            className={`title-bar-action${checkingForUpdates ? ' checking' : ''}`}
            onClick={onCheckForUpdates}
            disabled={checkingForUpdates}
            title={checkingForUpdates ? t('titlebar.checkingForUpdates') : t('titlebar.checkForUpdates')}
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M7 2a5 5 0 1 0 4.33 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M11 1v3.5H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <button className="title-bar-action" onClick={onAboutClick} title={t('titlebar.about')}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 11.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="5.5" r="0.5" fill="currentColor"/>
          </svg>
        </button>

        <div className="title-bar-sep" />

        {/* Workspace switcher (Fork-style) */}
        <button
          ref={wsBtnRef}
          type="button"
          className={`title-bar-workspace${wsOpen ? ' open' : ''}`}
          onClick={toggleWorkspaceMenu}
          title={t('workspace.switch')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="4" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="11" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="title-bar-workspace-name">{activeWorkspace?.name ?? t('workspace.switch')}</span>
          <svg className="title-bar-workspace-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="title-bar-sep" />
      </div>

      <div className="title-bar-controls">
        <button className="title-bar-button minimize" onClick={handleMinimize} title={t('titlebar.minimize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
          </svg>
        </button>
        <button className="title-bar-button maximize" onClick={handleMaximize} title={t('titlebar.maximize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button className="title-bar-button close" onClick={handleClose} title={t('titlebar.close')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {wsOpen && ReactDOM.createPortal(
        <div
          ref={wsMenuRef}
          className="title-bar-workspace-menu"
          style={{ top: menuPos.top, right: menuPos.right }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="title-bar-workspace-menu-label">{t('workspace.switch')}</div>
          {workspaces.map((ws) => (
            <div key={ws.id} className="title-bar-workspace-row">
              {renamingId === ws.id ? (
                <input
                  className="title-bar-workspace-rename"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`title-bar-workspace-item${ws.id === activeWorkspaceId ? ' active' : ''}`}
                  onClick={() => {
                    onWorkspaceSwitch?.(ws.id);
                    setWsOpen(false);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    startRename(ws.id);
                  }}
                >
                  <span className="title-bar-workspace-check" aria-hidden>
                    {ws.id === activeWorkspaceId ? '✓' : ''}
                  </span>
                  <span className="title-bar-workspace-item-name">{ws.name}</span>
                  <span className="title-bar-workspace-item-count">
                    {ws.logDirectories.length}
                  </span>
                </button>
              )}
            </div>
          ))}
          <div className="title-bar-workspace-sep" />
          <button
            type="button"
            className="title-bar-workspace-item"
            onClick={() => {
              onWorkspaceCreate?.();
              setWsOpen(false);
            }}
          >
            <span className="title-bar-workspace-check">+</span>
            <span>{t('workspace.new')}</span>
          </button>
          {activeWorkspace && (
            <>
              <button
                type="button"
                className="title-bar-workspace-item"
                onClick={() => startRename(activeWorkspace.id)}
              >
                <span className="title-bar-workspace-check" />
                <span>{t('workspace.rename')}</span>
              </button>
              <button
                type="button"
                className="title-bar-workspace-item danger"
                disabled={workspaces.length <= 1}
                onClick={() => {
                  onWorkspaceDelete?.(activeWorkspace.id);
                  setWsOpen(false);
                }}
              >
                <span className="title-bar-workspace-check" />
                <span>{t('workspace.delete')}</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default TitleBar;
