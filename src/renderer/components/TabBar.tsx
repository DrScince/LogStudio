import React from 'react';
import './TabBar.css';

export interface Tab {
  id: string;
  filePath: string;
  selectedNamespaces: string[];
  namespaces: string[];
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onTabSelect, onTabClose }) => {
  const getFileName = (filePath: string): string => {
    return filePath.split(/[/\\]/).pop() || 'Unbekannt';
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
          >
            <span className="tab-label">{getFileName(tab.filePath)}</span>
            <button
              className="tab-close"
              onClick={(e) => onTabClose(tab.id, e)}
              title="Tab schließen"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default TabBar;
