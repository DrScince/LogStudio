import React from 'react';
import './Toolbar.css';

interface ToolbarProps {
  onSettingsClick: () => void;
  onOpenFile: () => void;
  currentFile: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ onSettingsClick, onOpenFile, currentFile }) => {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="toolbar-title">LogStudio</h1>
      </div>
      <div className="toolbar-right">
        <button className="toolbar-button toolbar-button-primary" onClick={onOpenFile} title="Datei öffnen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 9.33333V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 2H14V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.66667 9.33333L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Öffnen</span>
        </button>
        <button className="toolbar-button" onClick={onSettingsClick} title="Einstellungen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.6667 8C12.6667 8.35362 12.8062 8.69276 13.0562 8.94281C13.3063 9.19286 13.6454 9.33333 14 9.33333C14.3546 9.33333 14.6937 9.19286 14.9438 8.94281C15.1938 8.69276 15.3333 8.35362 15.3333 8C15.3333 7.64638 15.1938 7.30724 14.9438 7.05719C14.6937 6.80714 14.3546 6.66667 14 6.66667C13.6454 6.66667 13.3063 6.80714 13.0562 7.05719C12.8062 7.30724 12.6667 7.64638 12.6667 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.33333 8C3.33333 8.35362 3.47281 8.69276 3.72286 8.94281C3.97291 9.19286 4.31205 9.33333 4.66667 9.33333C5.02129 9.33333 5.36043 9.19286 5.61048 8.94281C5.86052 8.69276 6 8.35362 6 8C6 7.64638 5.86052 7.30724 5.61048 7.05719C5.36043 6.80714 5.02129 6.66667 4.66667 6.66667C4.31205 6.66667 3.97291 6.80714 3.72286 7.05719C3.47281 7.30724 3.33333 7.64638 3.33333 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 3.33333C8 3.68795 7.85952 4.02709 7.60948 4.27714C7.35943 4.52719 7.02029 4.66667 6.66667 4.66667C6.31305 4.66667 5.97391 4.52719 5.72386 4.27714C5.47381 4.02709 5.33333 3.68795 5.33333 3.33333C5.33333 2.97871 5.47381 2.63957 5.72386 2.38952C5.97391 2.13948 6.31305 2 6.66667 2C7.02029 2 7.35943 2.13948 7.60948 2.38952C7.85952 2.63957 8 2.97871 8 3.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 12.6667C8 13.0213 7.85952 13.3604 7.60948 13.6105C7.35943 13.8605 7.02029 14 6.66667 14C6.31305 14 5.97391 13.8605 5.72386 13.6105C5.47381 13.3604 5.33333 13.0213 5.33333 12.6667C5.33333 12.312 5.47381 11.9729 5.72386 11.7229C5.97391 11.4728 6.31305 11.3333 6.66667 11.3333C7.02029 11.3333 7.35943 11.4728 7.60948 11.7229C7.85952 11.9729 8 12.312 8 12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
