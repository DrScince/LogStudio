import React, { useState, useEffect, useRef } from 'react';
import './Toolbar.css';

export interface Tab {
  id: string;
  filePath: string;
  filePaths?: string[]; // Für mehrere Dateien
  selectedNamespaces: string[];
  namespaces: string[];
}

interface ToolbarProps {
  onSettingsClick: () => void;
  onAboutClick: () => void;
  onOpenFile: () => void;
  onThemeToggle: () => void;
  currentTheme: 'dark' | 'light';
  currentFile: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onCloseAll: () => void;
  onCloseOthers: (tabId: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onSettingsClick, 
  onAboutClick, 
  onOpenFile, 
  onThemeToggle, 
  currentTheme, 
  currentFile,
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onCloseAll,
  onCloseOthers,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [contextMenu]);
  const getFileName = (filePath: string): string => {
    return filePath.split(/[/\\]/).pop() || 'Unbekannt';
  };

  const getTabLabel = (tab: Tab): string => {
    if (tab.filePaths && tab.filePaths.length > 1) {
      return `${tab.filePaths.length} Dateien`;
    }
    return getFileName(tab.filePath);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        {tabs.length > 0 && (
          <div className="toolbar-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const hasMultipleFiles = tab.filePaths && tab.filePaths.length > 1;
              const tooltipText = hasMultipleFiles 
                ? tab.filePaths.map(path => path.split(/[/\\]/).pop() || path).join('\n')
                : getTabLabel(tab);
              
              return (
                <div
                  key={tab.id}
                  className={`toolbar-tab ${isActive ? 'active' : ''}`}
                  onClick={() => onTabSelect(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      onTabClose(tab.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                  title={tooltipText}
                >
                  <span className="toolbar-tab-label">{getTabLabel(tab)}</span>
                  <button
                    className="toolbar-tab-close"
                    onClick={(e) => onTabClose(tab.id, e)}
                    title="Close Tab"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="toolbar-right">
        <button className="toolbar-button toolbar-button-primary" onClick={onOpenFile} title="Open File">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 9.33333V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 2H14V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.66667 9.33333L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Open</span>
        </button>
        <button className="toolbar-button" onClick={onSettingsClick} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button 
          className="toolbar-button" 
          onClick={onThemeToggle} 
          title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {currentTheme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button className="toolbar-button" onClick={onAboutClick} title="About">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 11.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="5.5" r="0.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseOthers(contextMenu.tabId); setContextMenu(null); }}
          >
            Alle anderen schließen
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseAll(); setContextMenu(null); }}
          >
            Alle schließen
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
