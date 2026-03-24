import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import './Toolbar.css';

export interface Tab {
  id: string;
  filePath: string;
  filePaths?: string[]; // Für mehrere Dateien
  selectedNamespaces: string[];
  namespaces: string[];
}

interface ToolbarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onCloseAll: () => void;
  onCloseOthers: (tabId: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onCloseAll,
  onCloseOthers,
}) => {
  const { t } = useTranslation();
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
      return t('toolbar.files', { count: tab.filePaths.length });
    }
    return getFileName(tab.filePath);
  };

  if (tabs.length === 0) return null;

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-tabs">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const tooltipText = tab.filePaths && tab.filePaths.length > 1
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
                    title={t('toolbar.closeTab')}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
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
            {t('toolbar.closeOthers')}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseAll(); setContextMenu(null); }}
          >
            {t('toolbar.closeAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
