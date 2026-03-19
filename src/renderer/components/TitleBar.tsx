import React from 'react';
import './TitleBar.css';

interface TitleBarProps {
  onOpenFile: () => void;
  onSettingsClick: () => void;
  onAboutClick: () => void;
  onThemeToggle: () => void;
  onCheckForUpdates: () => void;
  currentTheme: 'dark' | 'light';
  checkingForUpdates: boolean;
  updateAvailable: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({
  onOpenFile,
  onSettingsClick,
  onAboutClick,
  onThemeToggle,
  onCheckForUpdates,
  currentTheme,
  checkingForUpdates,
  updateAvailable,
}) => {
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
        {/* Open – primärer Button mit Text */}
        <button className="title-bar-action title-bar-action-primary" onClick={onOpenFile} title="Open File">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M14 9.33333V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 2H14V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.66667 9.33333L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Open</span>
        </button>

        <div className="title-bar-sep" />

        {/* Icon-Gruppe: Settings, Theme, Updates, About */}
        <button className="title-bar-action" onClick={onSettingsClick} title="Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button className="title-bar-action" onClick={onThemeToggle} title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
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
            title={checkingForUpdates ? 'Suche nach Updates…' : 'Nach Updates suchen'}
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M7 2a5 5 0 1 0 4.33 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M11 1v3.5H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <button className="title-bar-action" onClick={onAboutClick} title="About">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 11.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="5.5" r="0.5" fill="currentColor"/>
          </svg>
        </button>

        <div className="title-bar-sep" />
      </div>

      <div className="title-bar-controls">
        <button className="title-bar-button minimize" onClick={handleMinimize} title="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
          </svg>
        </button>
        <button className="title-bar-button maximize" onClick={handleMaximize} title="Maximize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button className="title-bar-button close" onClick={handleClose} title="Close">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
