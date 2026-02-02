import React from 'react';
import './Toolbar.css';

interface ToolbarProps {
  onSettingsClick: () => void;
  currentFile: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ onSettingsClick, currentFile }) => {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-title">LogStudio</h1>
        {currentFile && (
          <span className="toolbar-file-name">
            {currentFile.split(/[/\\]/).pop()}
          </span>
        )}
      </div>
      <div className="toolbar-right">
        <button className="toolbar-button" onClick={onSettingsClick} title="Einstellungen">
          ⚙️
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
